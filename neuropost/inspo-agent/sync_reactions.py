"""
NeuroPost Sync Reactions — lee los ❤️ del canal y aprueba en Supabase
GitHub Actions lo ejecuta cada hora.

Cómo funciona:
- Llama a la API de Telegram para obtener las reacciones de cada mensaje
- Los mensajes con ❤️ (emoji de corazón) → status = 'approved'
- Los mensajes sin reacción → se quedan como 'pending'
- No toca los ya aprobados o rechazados
"""

import os
import requests
from datetime import datetime
from supabase import create_client

# ── Credenciales ──────────────────────────────────────────────────────────────
TELEGRAM_TOKEN = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT  = os.environ["TELEGRAM_CHANNEL_ID"]
SUPABASE_URL   = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY   = os.environ["SUPABASE_SERVICE_ROLE_KEY"]

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

HEART_EMOJIS = {"❤", "❤️", "🔥", "👍"}  # cualquiera de estos = aprobado

# ── Telegram ──────────────────────────────────────────────────────────────────

def get_message_reactions(message_id: int) -> set[str]:
    """
    Obtiene las reacciones de un mensaje en el canal.
    Requiere que el bot sea admin del canal.
    """
    url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/getMessageReactionCount"
    try:
        r = requests.post(url, json={
            "chat_id":    TELEGRAM_CHAT,
            "message_id": message_id,
        }, timeout=10)
        if not r.ok:
            return set()
        data     = r.json()
        reactions = data.get("result", {}).get("reactions", [])
        emojis   = set()
        for reaction in reactions:
            r_type = reaction.get("type", {})
            if r_type.get("type") == "emoji":
                emojis.add(r_type.get("emoji", ""))
        return emojis
    except Exception as e:
        print(f"  [Telegram] Error leyendo reacciones msg {message_id}: {e}")
        return set()

# ── Sync ──────────────────────────────────────────────────────────────────────

def sync():
    print(f"\n{'='*50}")
    print(f"🔄 Sync Reactions — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*50}\n")

    # Coge todos los pins pending que tienen telegram_msg_id
    try:
        res = supabase.table("inspiration_pins") \
            .select("id, pinterest_id, telegram_msg_id, title, negocio") \
            .eq("status", "pending") \
            .not_.is_("telegram_msg_id", "null") \
            .execute()
        pending = res.data or []
    except Exception as e:
        print(f"[Supabase] Error leyendo pendientes: {e}")
        return

    if not pending:
        print("No hay pins pendientes con mensaje en Telegram.")
        return

    print(f"📥 Revisando {len(pending)} pins pendientes...\n")

    approved_count = 0

    for pin in pending:
        msg_id = pin.get("telegram_msg_id")
        if not msg_id:
            continue

        reactions = get_message_reactions(int(msg_id))
        has_heart = bool(reactions & HEART_EMOJIS)

        if has_heart:
            try:
                supabase.table("inspiration_pins").update({
                    "status":      "approved",
                    "approved_at": datetime.utcnow().isoformat(),
                }).eq("id", pin["id"]).execute()

                print(f"  ✅ APROBADO — {pin.get('negocio')} | {pin.get('title', '')[:40]}")
                approved_count += 1
            except Exception as e:
                print(f"  [Supabase] Error aprobando {pin['id']}: {e}")
        else:
            print(f"  ⏳ Sin reacción — {pin.get('title', '')[:40]}")

    print(f"\n✅ Sync completado — {approved_count} nuevos aprobados de {len(pending)} revisados")

    # Resumen en Telegram solo si hay aprobaciones nuevas
    if approved_count > 0:
        requests.post(
            f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
            json={
                "chat_id":    TELEGRAM_CHAT,
                "text":       f"✅ *{approved_count} pins aprobados* y guardados en NeuroPost 🎨",
                "parse_mode": "Markdown",
            },
            timeout=10
        )

if __name__ == "__main__":
    sync()
