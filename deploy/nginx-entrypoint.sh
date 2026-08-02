#!/bin/sh
set -e

HTML=/usr/share/nginx/html
CONF_SRC="$HTML/_deploy/nginx/default.conf"

echo "[cobea-frontend] Contenu monté dans $HTML :"
ls -la "$HTML" || true

# Cas fréquent : copie du dossier frontend DANS frontend/ → frontend/frontend/index.html
if [ ! -f "$HTML/index.html" ] && [ -f "$HTML/frontend/index.html" ]; then
  echo "[cobea-frontend] Nesting détecté (frontend/frontend/). Correction…"
  # Volume doit être writable (sans :ro)
  for item in "$HTML/frontend"/* "$HTML/frontend"/.[!.]*; do
    [ -e "$item" ] || continue
    base=$(basename "$item")
    [ "$base" = "." ] || [ "$base" = ".." ] && continue
    if [ ! -e "$HTML/$base" ]; then
      mv "$item" "$HTML/$base"
    fi
  done
  rmdir "$HTML/frontend" 2>/dev/null || rm -rf "$HTML/frontend"
fi

# Autre cas : tout est dans dist/
if [ ! -f "$HTML/index.html" ] && [ -f "$HTML/dist/index.html" ]; then
  echo "[cobea-frontend] Nesting dist/ détecté. Correction…"
  for item in "$HTML/dist"/* "$HTML/dist"/.[!.]*; do
    [ -e "$item" ] || continue
    base=$(basename "$item")
    if [ ! -e "$HTML/$base" ]; then
      mv "$item" "$HTML/$base"
    fi
  done
  rmdir "$HTML/dist" 2>/dev/null || rm -rf "$HTML/dist"
fi

if [ -f "$CONF_SRC" ]; then
  cp "$CONF_SRC" /etc/nginx/conf.d/default.conf
else
  echo "[cobea-frontend] ATTENTION: config _deploy manquante"
fi

if [ ! -f "$HTML/index.html" ]; then
  echo "[cobea-frontend] ERREUR: toujours pas d'index.html — page diagnostic"
  FILES=$(ls -la "$HTML" 2>&1 | sed 's/&/\&amp;/g; s/</\&lt;/g')
  cat > "$HTML/index.html" <<EOF
<!DOCTYPE html>
<html lang="fr"><head><meta charset="utf-8"><title>Cobea — frontend mal copié</title></head>
<body style="font-family:system-ui;max-width:40rem;margin:2rem auto;padding:0 1rem">
<h1>frontend/ incomplet</h1>
<p><code>index.html</code> doit être <strong>directement</strong> dans :</p>
<pre>/Volume1/Docker/cobea/frontend/index.html</pre>
<p>Sur le PC :</p>
<pre>npm run prepare:nas</pre>
<p>Puis copie le dossier <code>frontend/</code> entier (son <em>contenu</em> doit inclure index.html à la racine).</p>
<h2>Contenu actuel du volume</h2>
<pre style="background:#f4f4f5;padding:1rem;overflow:auto">$FILES</pre>
</body></html>
EOF
fi

echo "[cobea-frontend] index.html OK → démarrage nginx"
exec nginx -g "daemon off;"
