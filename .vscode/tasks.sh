#!/bin/bash

docker compose down --timeout=0
docker compose build site
SITE_PORT=3010 docker compose up -d site
__NV_PRIME_RENDER_OFFLOAD=1 __GLX_VENDOR_LIBRARY_NAME=nvidia __VK_LAYER_NV_optimus=NVIDIA_only google-chrome --new-window https://agent-visier.local
