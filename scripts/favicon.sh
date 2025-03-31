#!/usr/bin/env bash
magick convert -size 512x512 xc:none -draw "roundrectangle 0,0,512,512,120,120" -alpha set mask.png
magick convert src/favicon.jpg -resize 512x512 -alpha set mask.png -compose DstIn -composite -define icon:auto-resize=16,32,48,64,128,256 src/favicon.ico