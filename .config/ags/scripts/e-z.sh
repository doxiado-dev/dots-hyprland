#!/bin/bash -e

auth_file=$(eval echo ~/.config/.e-z.key)

if [ ! -f "$auth_file" ]; then
    touch "$auth_file"
    echo "# Go to https://e-z.gg/dash/account" >> "$auth_file"
    echo "## Make sure you're log in and Copy the API KEY and paste it below." >> "$auth_file"
    echo "API Key file created at $auth_file. Please add your API KEY to this file."
    notify-send "API Key file created." "Add it to $auth_file."
    exit 1
fi

auth=""
while IFS= read -r line; do
    [[ "$line" =~ ^#.*$ ]] && continue
    auth="$line"
done < "$auth_file"

if [[ -z "$auth" ]]; then
    echo "API Key is not set in $auth_file."
    echo "Edit the file to add your E-Z API KEY."
    notify-send "API Key is not added." "Add it to $auth_file"
    exit 1
fi

url="https://api.e-z.host/files"

temp_file="/tmp/screenshot.png"
config_file=$(eval echo ~/.config/flameshot/flameshot.ini)

if [ ! -f "$config_file" ]; then
    mkdir -p "$(dirname "$config_file")"
    touch "$config_file"
fi

if ! grep -q "disabledGrimWarning=true" "$config_file"; then
    echo "disabledGrimWarning=true" >> "$config_file"
fi

if [[ "$1" == "--full" ]]; then
    flameshot screen -r > $temp_file
else
    flameshot gui -r > $temp_file &
    ags run-js "closeEverything();"
    wait
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
