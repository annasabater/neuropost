"""
NeuroPost Inspiration Agent — Crawler nocturno
GitHub Actions lo ejecuta cada noche a la 1:00 AM.

Flujo:
1. Busca pins en Pinterest (400 queries del JSON)
2. Claude filtra con criterio estético
3. Guarda como 'pending' en Supabase
4. Envía cada pin como foto/video real al canal de Telegram
5. Tú le das ❤️ a los que quieres → sync_reactions.py los aprueba
"""

import os
import json
import random
import requests
import anthropic
from datetime import datetime
from supabase import create_client

# ── Credenciales ──────────────────────────────────────────────────────────────
PINTEREST_TOKEN = os.environ["PINTEREST_ACCESS_TOKEN"]
ANTHROPIC_KEY   = os.environ["ANTHROPIC_API_KEY"]
SUPABASE_URL    = os.environ["NEXT_PUBLIC_SUPABASE_URL"]
SUPABASE_KEY    = os.environ["SUPABASE_SERVICE_ROLE_KEY"]
TELEGRAM_TOKEN  = os.environ["TELEGRAM_BOT_TOKEN"]
TELEGRAM_CHAT   = os.environ["TELEGRAM_CHANNEL_ID"]  # @neuropost_inspo o -100xxx

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

with open("queries.json", "r") as f:
    QUERIES_DATA = json.load(f)

# ── Config ────────────────────────────────────────────────────────────────────
CATEGORIES_PER_BUSINESS = 3
PINS_PER_QUERY          = 6
MAX_PINS_PER_CATEGORY   = 2

NEGOCIO_EMOJI = {
    "gym": "💪", "restaurant": "🍽️", "aesthetic_clinic": "✨",
    "hair_salon": "💇", "retail_store": "🛍️", "coffee_shop": "☕",
    "yoga_studio": "🧘", "physiotherapy_center": "🏥",
    "academy": "📚", "bar": "🍸"
}

# ── Pinterest API ─────────────────────────────────────────────────────────────

def search_pins(query: str, page_size: int = 6) -> list[dict]:
    url     = "https://api.pinterest.com/v5/search/pins"
    headers = {"Authorization": f"Bearer {PINTEREST_TOKEN}"}
    params  = {"query": query, "page_size": page_size}
    try:
        r = requests.get(url, headers=headers, params=params, timeout=15)
        r.raise_for_status()
        return r.json().get("items", [])
    except Exception as e:
        print(f"  [Pinterest] Error '{query}': {e}")
        return []

def extract_pin(raw: dict) -> dict | None:
    try:
        media  = raw.get("media", {})
        images = media.get("images", {})
        img    = (images.get("1200x", {}).get("url")
               or images.get("600x",  {}).get("url")
               or images.get("400x300", {}).get("url") or "")
        if not img:
            return None

        # Detecta si es video
        is_video   = media.get("media_type", "image") == "video"
        video_url  = ""
        if is_video:
            video_data = media.get("video_data", {})
            # Intenta obtener la URL del video en la mejor calidad disponible
            for quality in ["V_1080P", "V_720P", "V_480P", "V_360P"]:
                video_url = video_data.get(quality, {}).get("url", "")
                if video_url:
                    break

        return {
            "pinterest_id":  raw.get("id", ""),
            "title":         raw.get("title", "").strip(),
            "description":   raw.get("description", "").strip(),
            "image_url":     img,
            "video_url":     video_url,
            "pinterest_url": f"https://pinterest.com/pin/{raw.get('id','')}",
            "media_type":    "video" if is_video else "image",
        }
    except Exception:
        return None

# ── Claude filter ─────────────────────────────────────────────────────────────

FILTER_PROMPT = """Eres curador visual para NeuroPost, agencia de social media para negocios locales españoles.

Negocio: {negocio} | Categoría: {categoria} | Query: "{query}"

Selecciona máximo {max_pins} pins que cumplan TODO:
✅ Calidad visual alta (composición, color, iluminación)
✅ Concepto original, no stock genérico ni publicidad obvia
✅ Útil como inspiración real para crear contenido en redes sociales
✅ Estética clara y reconocible

❌ Descarta: stock genérico, spam, sin imagen, concepto muy visto

Responde SOLO con JSON sin backticks:
{{"selected": ["id1", "id2"], "reasoning": "una línea"}}

Pins:
{pins_json}"""

def filter_with_claude(pins: list[dict], negocio: str, categoria: str, query: str) -> list[dict]:
    if not pins:
        return []
    client = anthropic.Anthropic(api_key=ANTHROPIC_KEY)
    pins_for_claude = [
        {"id": p["pinterest_id"], "title": p["title"],
         "description": p["description"], "media_type": p["media_type"]}
        for p in pins
    ]
    try:
        resp = client.messages.create(
            model="claude-sonnet-4-20250514",
            max_tokens=400,
            messages=[{"role": "user", "content": FILTER_PROMPT.format(
                negocio=negocio, categoria=categoria, query=query,
                max_pins=MAX_PINS_PER_CATEGORY,
                pins_json=json.dumps(pins_for_claude, ensure_ascii=False)
            )}]
        )
        result    = json.loads(resp.content[0].text.strip())
        selected  = set(result.get("selected", []))
        reasoning = result.get("reasoning", "")
        print(f"    [Claude] {len(selected)} aprobados — {reasoning}")
        return [p for p in pins if p["pinterest_id"] in selected]
    except Exception as e:
        print(f"    [Claude] Error: {e}")
        return []

# ── Telegram — envía foto o video real ───────────────────────────────────────

def send_pin_to_channel(pin: dict, negocio: str, categoria: str) -> int | None:
    """
    Envía el pin como foto o video nativo a Telegram.
    Devuelve el message_id para luego leer las reacciones.
    """
    emoji   = NEGOCIO_EMOJI.get(negocio, "📌")
    caption = f"{emoji} *{pin['title'] or 'Sin título'}*\n`{negocio}` · `{categoria}`"
    if pin["description"]:
        caption += f"\n_{pin['description'][:120]}_"

    base_url = f"https://api.telegram.org/bot{TELEGRAM_TOKEN}"

    # Intenta enviar como video si lo es y tiene URL de video
    if pin["media_type"] == "video" and pin.get("video_url"):
        endpoint = f"{base_url}/sendVideo"
        payload  = {
            "chat_id":    TELEGRAM_CHAT,
            "video":      pin["video_url"],
            "caption":    caption,
            "parse_mode": "Markdown",
        }
    else:
        # Siempre foto — nunca link
        endpoint = f"{base_url}/sendPhoto"
        payload  = {
            "chat_id":    TELEGRAM_CHAT,
            "photo":      pin["image_url"],
            "caption":    caption,
            "parse_mode": "Markdown",
        }

    try:
        r = requests.post(endpoint, json=payload, timeout=20)
        r.raise_for_status()
        msg_id = r.json()["result"]["message_id"]
        print(f"    [Telegram] ✅ Enviado msg_id={msg_id} ({pin['media_type']})")
        return msg_id
    except Exception as e:
        print(f"    [Telegram] ❌ Error: {e}")
        # Fallback: si el video falla, intenta con la imagen estática
        if pin["media_type"] == "video":
            try:
                r2 = requests.post(f"{base_url}/sendPhoto", json={
                    "chat_id":    TELEGRAM_CHAT,
                    "photo":      pin["image_url"],
                    "caption":    caption + "\n_(preview — es video en Pinterest)_",
                    "parse_mode": "Markdown",
                }, timeout=20)
                r2.raise_for_status()
                return r2.json()["result"]["message_id"]
            except Exception as e2:
                print(f"    [Telegram] ❌ Fallback también falló: {e2}")
        return None

# ── Supabase ──────────────────────────────────────────────────────────────────

def save_pin(pin: dict, negocio: str, categoria: str, query: str, msg_id: int | None):
    try:
        supabase.table("inspiration_pins").upsert({
            "pinterest_id":  pin["pinterest_id"],
            "negocio":       negocio,
            "categoria":     categoria,
            "query":         query,
            "title":         pin["title"],
            "description":   pin["description"],
            "image_url":     pin["image_url"],
            "video_url":     pin.get("video_url", ""),
            "pinterest_url": pin["pinterest_url"],
            "media_type":    pin["media_type"],
            "status":        "pending",
            "telegram_msg_id": msg_id,
        }, on_conflict="pinterest_id").execute()
    except Exception as e:
        print(f"    [Supabase] Error: {e}")

def notify_summary(total_new: int, negocios: list[str]):
    text = (
        f"━━━━━━━━━━━━━━━━━━\n"
        f"🌙 *Búsqueda completada*\n"
        f"✨ *{total_new} pins* listos para revisar\n"
        f"Negocios: {', '.join(negocios)}\n\n"
        f"Dale ❤️ a los que quieras publicar 👆"
    )
    requests.post(
        f"https://api.telegram.org/bot{TELEGRAM_TOKEN}/sendMessage",
        json={"chat_id": TELEGRAM_CHAT, "text": text, "parse_mode": "Markdown"},
        timeout=10
    )

# ── Main ──────────────────────────────────────────────────────────────────────

def run():
    print(f"\n{'='*55}")
    print(f"🚀 NeuroPost Inspo Agent — {datetime.now().strftime('%Y-%m-%d %H:%M')}")
    print(f"{'='*55}\n")

    total_new      = 0
    negocios_vistos = []

    for negocio_data in QUERIES_DATA["negocios"]:
        negocio = negocio_data["tipo"]
        slug    = negocio_data["slug"]
        queries = negocio_data["queries"]

        cats_tonight = random.sample(list(queries.keys()), min(CATEGORIES_PER_BUSINESS, len(queries)))
        print(f"\n📌 {negocio.upper()} — {', '.join(cats_tonight)}")
        negocios_vistos.append(slug)

        for categoria in cats_tonight:
            queries_tonight = random.sample(queries[categoria], min(2, len(queries[categoria])))

            for query in queries_tonight:
                print(f"  🔎 '{query}'")
                raw   = search_pins(query, PINS_PER_QUERY)
                pins  = [p for p in (extract_pin(r) for r in raw) if p]
                print(f"     Encontrados: {len(pins)}")

                approved = filter_with_claude(pins, negocio, categoria, query)

                for pin in approved:
                    msg_id = send_pin_to_channel(pin, negocio, categoria)
                    save_pin(pin, negocio, categoria, query, msg_id)
                    total_new += 1

    print(f"\n✅ {total_new} pins enviados al canal")
    notify_summary(total_new, negocios_vistos)

if __name__ == "__main__":
    run()
