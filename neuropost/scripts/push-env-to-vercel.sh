#!/usr/bin/env bash
# =============================================================================
#  push-env-to-vercel.sh
# -----------------------------------------------------------------------------
#  Lee un archivo .env (por defecto .env.local) y sube cada KEY=VALUE a Vercel
#  en los entornos production, preview y development.
#
#  Salta líneas en blanco, comentarios, y placeholders obvios tipo
#  `sk_test_...`, `replace-with-...`, `price_...`.
#
#  Uso:
#      ./scripts/push-env-to-vercel.sh                  # usa .env.local
#      ./scripts/push-env-to-vercel.sh .env.prod        # archivo custom
#      ./scripts/push-env-to-vercel.sh --dry-run        # solo muestra
#
#  Requiere:  vercel CLI (`npm i -g vercel`) + `vercel link` ya hecho.
# =============================================================================

set -eu

ENV_FILE=".env.local"
DRY_RUN=false
TARGETS=("production" "preview" "development")

# ─── Parse args ──────────────────────────────────────────────────────────────
for arg in "$@"; do
  case "$arg" in
    --dry-run|-n) DRY_RUN=true ;;
    -h|--help)
      head -n 17 "$0" | tail -n 16
      exit 0
      ;;
    -*)
      echo "❌ Flag desconocida: $arg"
      exit 1
      ;;
    *) ENV_FILE="$arg" ;;
  esac
done

# ─── Preflight ───────────────────────────────────────────────────────────────
if ! command -v vercel >/dev/null 2>&1; then
  echo "❌ Vercel CLI no está instalada."
  echo "   Instala con:  npm i -g vercel"
  exit 1
fi

if [ ! -f "$ENV_FILE" ]; then
  echo "❌ Archivo no encontrado: $ENV_FILE"
  echo "   Ejecuta este script desde la carpeta neuropost/ (donde vive .env.local)"
  exit 1
fi

if [ ! -f ".vercel/project.json" ]; then
  echo "❌ Este directorio no está vinculado a Vercel todavía."
  echo "   Ejecuta una vez:  vercel link"
  exit 1
fi

# ─── Banner ──────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Vercel env upload"
echo "  archivo:  $ENV_FILE"
echo "  destino:  production · preview · development"
if [ "$DRY_RUN" = "true" ]; then
  echo "  modo:     DRY RUN (no sube nada, solo muestra)"
fi
echo "════════════════════════════════════════════════════════════════════"
echo ""

if [ "$DRY_RUN" = "false" ]; then
  echo "  ⚠️  IMPORTANTE: asegúrate de que los secretos en $ENV_FILE"
  echo "      son los valores ROTADOS (no los antiguos que filtraste)."
  echo ""
  printf "  ¿Continuar? (escribe 'si' para confirmar): "
  read -r CONFIRM
  if [ "$CONFIRM" != "si" ]; then
    echo "  Cancelado."
    exit 0
  fi
  echo ""
fi

# ─── Main loop ───────────────────────────────────────────────────────────────
COUNT_OK=0
COUNT_SKIP=0
COUNT_FAIL=0

is_placeholder() {
  # Devuelve 0 (true) si el valor parece un placeholder y debe saltarse.
  local v="$1"
  # Vacío
  [ -z "$v" ] && return 0
  # Termina en "..." (típico sk_test_..., price_...)
  case "$v" in
    *...) return 0 ;;
  esac
  # Contiene "replace-with"
  case "$v" in
    *replace-with*) return 0 ;;
  esac
  return 1
}

strip_quotes() {
  local v="$1"
  # Quita comillas dobles envolventes
  if [ "${v#\"}" != "$v" ] && [ "${v%\"}" != "$v" ]; then
    v="${v#\"}"
    v="${v%\"}"
  fi
  # Quita comillas simples envolventes
  if [ "${v#\'}" != "$v" ] && [ "${v%\'}" != "$v" ]; then
    v="${v#\'}"
    v="${v%\'}"
  fi
  printf '%s' "$v"
}

while IFS= read -r line || [ -n "$line" ]; do
  # Saltar líneas vacías y comentarios
  case "$line" in
    ''|\#*) continue ;;
  esac

  # Quitar espacios iniciales
  line="${line#"${line%%[![:space:]]*}"}"
  case "$line" in
    \#*) continue ;;
  esac

  # Requiere KEY=VALUE
  case "$line" in
    *=*) ;;
    *) continue ;;
  esac

  key="${line%%=*}"
  value="${line#*=}"

  # Trim key
  key="${key#"${key%%[![:space:]]*}"}"
  key="${key%"${key##*[![:space:]]}"}"

  # Trim value
  value="${value#"${value%%[![:space:]]*}"}"
  value="${value%"${value##*[![:space:]]}"}"

  # Strip surrounding quotes
  value="$(strip_quotes "$value")"

  # Validar nombre (solo letras/dígitos/_)
  case "$key" in
    ''|[!A-Za-z_]*)
      continue
      ;;
  esac

  # Saltar placeholders
  if is_placeholder "$value"; then
    printf "⊘  %-40s  placeholder/vacío\n" "$key"
    COUNT_SKIP=$((COUNT_SKIP + 1))
    continue
  fi

  for env in "${TARGETS[@]}"; do
    if [ "$DRY_RUN" = "true" ]; then
      printf "   [dry] %-40s → %s\n" "$key" "$env"
      COUNT_OK=$((COUNT_OK + 1))
    else
      # `vercel env add` lee el value por stdin
      if printf '%s' "$value" | vercel env add "$key" "$env" >/dev/null 2>&1; then
        printf "✓  %-40s → %s\n" "$key" "$env"
        COUNT_OK=$((COUNT_OK + 1))
      else
        printf "✗  %-40s → %s  (ya existe? usa:  vercel env rm %s %s --yes)\n" \
          "$key" "$env" "$key" "$env"
        COUNT_FAIL=$((COUNT_FAIL + 1))
      fi
    fi
  done
done < "$ENV_FILE"

# ─── Resumen ─────────────────────────────────────────────────────────────────
echo ""
echo "════════════════════════════════════════════════════════════════════"
echo "  Resumen:  $COUNT_OK ok · $COUNT_FAIL fallos · $COUNT_SKIP saltados"
echo "════════════════════════════════════════════════════════════════════"

if [ "$DRY_RUN" = "false" ] && [ "$COUNT_OK" -gt 0 ]; then
  echo ""
  echo "  Siguiente paso — redeploy para que las vars entren en producción:"
  echo ""
  echo "      vercel --prod"
  echo ""
fi
