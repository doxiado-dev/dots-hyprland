#!/bin/bash -e

# Go to https://e-z.gg/dash/account
## Make sure you're log in and Copy the API KEY and put it below this.
auth=""
url="https://api.e-z.host/files"

temp_file="/tmp/screenshot.png"
config_file="$HOME/.config/flameshot/flameshot.ini"

if [[ -z "$auth" ]]; then
    echo "API Key is not set."
    echo "Edit the script on $HOME/.config/ags/scripts/e-z.sh to add your E-Z API KEY on the auth variable."
    notify-send "API Key is not added." 'Edit the script to add your E-Z API KEY.'
    exit 1
fi

if [ ! -f "$config_file" ]; then
    mkdir -p "$(dirname "$config_file")"
    touch "$config_file"
fi

if ! grep -q "disabledGrimWarning=true" "$config_file"; then
    echo "disabledGrimWarning=true" >> "$config_file"
fi

if [[ "$1" == "--full" ]]; then
        XDG_CURRENT_DESKTOP=SWAY flameshot screen -r > $temp_file
    else
        XDG_CURRENT_DESKTOP=SWAY flameshot gui -r > $temp_file
        fi

if [[ $(file --mime-type -b $temp_file) != "image/png" ]]; then
    rm $temp_file
    exit 1
fi

image_url=$(curl -X POST -F "file=@"$temp_file -H "key: "$auth -v "$url" 2>/dev/null)
echo $image_url > /tmp/upload.json
response_file="/tmp/upload.json"

if ! jq -e . >/dev/null 2>&1 < /tmp/upload.json; then
    notify-send "Error occurred while uploading. Please try again later." -a "Flameshot"
    rm $temp_file
    rm $response_file
    exit 1
fi

success=$(cat /tmp/upload.json | jq -r ".success")
if [[ "$success" != "true" ]] || [[ "$success" == "null" ]]; then
    error=$(cat /tmp/upload.json | jq -r ".error")
    if [[ "$error" == "null" ]]; then
        notify-send "Error occurred while uploading. Please try again later." -a "Flameshot"
        rm $temp_file
        rm $response_file
        exit 1
    else
        notify-send "Error: $error" -a "Flameshot"
        rm $temp_file
        rm $response_file
        exit 1
    fi
fi

cat /tmp/upload.json | jq -r ".imageUrl" | wl-copy
notify-send "Image URL copied to clipboard" -a "Flameshot" -i $temp_file
rm $temp_file
fi
