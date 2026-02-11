# Ask Agent - Webchat Integration

The "Ask Agent" feature in the Agent Dashboard now automatically sends questions to the webchat instead of just copying to clipboard.

## How It Works

### Dashboard Side (Automatic)

When you click **🚀 Send to Agent**:

1. **BroadcastChannel** - Sends the message via browser's BroadcastChannel API (works instantly if webchat is open)
2. **URL Parameter** - Opens webchat with `?message=...` parameter as fallback
3. **Window Focus** - Opens/focuses the webchat window

The 📋 button is still available for manual copy-to-clipboard.

### Webchat Side (Optional Enhancement)

The webchat needs to listen for incoming messages. There are several ways to enable this:

#### Option 1: Browser Console (Temporary)

1. Open the webchat in your browser
2. Open Developer Tools (F12 or Cmd+Opt+I)
3. Paste the contents of `js/webchat-bridge.js` into the Console
4. Press Enter

This only lasts until you refresh the page.

#### Option 2: Userscript (Persistent)

1. Install [Tampermonkey](https://www.tampermonkey.net/) browser extension
2. Create a new userscript
3. Paste the contents of `js/webchat-bridge.js`
4. Save and enable

The script includes proper userscript headers for automatic matching.

#### Option 3: Without Bridge

If you can't install the webchat bridge:

1. Click **🚀 Send to Agent** in the dashboard
2. The webchat opens with your message in the URL
3. The message text is in the URL (but not auto-filled into the input)
4. You may need to manually paste (use 📋 button first)

## Features

### Send to Agent Button
- **🚀 Send to Agent** - Opens webchat with your question pre-filled
- **📋** - Copy to clipboard (fallback option)
- **⌘/Ctrl+Enter** - Keyboard shortcut to send

### Context Included

The message sent to the agent includes:
- Session label and key
- Agent name and status
- Task (what the agent was asked to do)
- Result (what the agent produced)
- Your question

## Technical Details

### BroadcastChannel

Channel name: `openclaw-webchat`

Message format:
```javascript
{
    type: 'fill-message',
    text: 'formatted message string'
}
```

### URL Parameter

Parameter: `message` (URL-encoded)

Example: `http://localhost:5173/?message=Hello%20Agent`

## Troubleshooting

### Message Not Appearing in Webchat

1. Make sure the webchat bridge is installed (see Options above)
2. Check browser console for errors
3. Try the clipboard fallback (📋 button)

### BroadcastChannel Not Working

BroadcastChannel requires:
- Same origin (both pages on same domain)
- Modern browser (Chrome 54+, Firefox 38+, Safari 15.4+)

### URL Parameter Not Working

The webchat may not support URL parameter prefill by default. Use the webchat-bridge.js script to add this functionality.
