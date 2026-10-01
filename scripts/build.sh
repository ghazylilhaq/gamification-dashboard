#!/usr/bin/env sh
# Wraps dashboard.html (the claude.ai artifact source, which has no document
# skeleton) into a standalone index.html for GitHub Pages.
set -e
cd "$(dirname "$0")/.."
{
  printf '<!doctype html>\n<html lang="en">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">\n<style>[hidden]{display:none!important}body{margin:0}img{max-width:100%%}</style>\n</head>\n<body>\n'
  cat dashboard.html
  printf '\n</body>\n</html>\n'
} > index.html
