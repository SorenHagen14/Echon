# Wireframe — Voice Agent Config

Settings → Voice agent → detail page. The Client's primary lever for
shaping how the agent sounds and behaves.

## Sections

### 1. Identity
- Agent name (string)
- Voice (preset dropdown; audio preview button per voice)
- Tone preset: Friendly / Professional / Direct
- Speaking rate (slow / normal / fast)

### 2. Greeting
- Greeting script (editable, multiline)
- Variable insertion menu: `{business_name}`, `{caller_name_if_known}`,
  `{time_of_day}`
- Live preview button — synthesizes the greeting with current voice

### 3. System prompt addendum
Advanced. Appended to the base HVAC system prompt.
- Free-text area, ~500 words max
- Examples panel: "Tell the agent things like 'Always confirm the address
  twice,' or 'If the caller mentions our truck, say thanks for the photo.'"
- Warning: "Changes here can affect agent reliability. Test after editing."

### 4. Behavior rules
- Confirm address before booking? (toggle, default on)
- Repeat back phone number for confirmation? (toggle, default on)
- Offer SMS confirmation after booking? (toggle, default on)
- Max call duration before auto-escalate (slider, 3-15 min, default 8)
- Silence timeout (slider, 3-10s, default 5)

### 5. Recording & disclosure
- Record calls? (toggle, default on)
- Auto-disclosure ("This call is being recorded for quality") — required
  in two-party-consent states; auto-injected based on Client's address
- Manual override of disclosure script (advanced)

### 6. Test call
- "Call my phone now" — Vapi places outbound test call to verified number
- Sandbox transcript shown after call ends
- Doesn't count against billing

## Behavior
- All saves debounce 3s before pushing to Vapi
- Saving updates the live agent — no "publish" step
- Changes to voice or system prompt addendum show a banner: "Changes are
  live. Recent calls used the previous config."
