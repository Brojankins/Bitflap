#!/usr/bin/env bash
# Tile a folder of stills into one contact sheet: render/contact.sh out/stills [cols] [width]
DIR=$1; COLS=${2:-4}; WD=${3:-480}
FF=${FFMPEG:-$(python3 -c "import imageio_ffmpeg;print(imageio_ffmpeg.get_ffmpeg_exe())")}
N=$(ls "$DIR"/*.png | grep -v contact | wc -l); ROWS=$(( (N + COLS - 1) / COLS ))
"$FF" -y -loglevel error -pattern_type glob -i "$DIR/[!c]*.png" -vf "scale=$WD:-1,pad=iw+6:ih+6:3:3:color=0x333333,tile=${COLS}x${ROWS}" -frames:v 1 "$DIR/contact.png" && echo "$DIR/contact.png"
