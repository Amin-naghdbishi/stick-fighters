with open("src/game/audio.ts", "r") as f:
    text = f.read()

text = text.replace("noise.start(now);", "noise.start(now);\n        noise.stop(now + duration);\n        noise.onended = () => { noise.disconnect(); gain.disconnect(); filter.disconnect(); };")
text = text.replace("snap.start(now);", "snap.start(now);\n        snap.stop(now + snapLen);\n        snap.onended = () => { snap.disconnect(); snapGain.disconnect(); snapFilter.disconnect(); };")

with open("src/game/audio.ts", "w") as f:
    f.write(text)
