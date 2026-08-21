import re
import sys

def process_file(filepath):
    with open(filepath, 'r') as f:
        content = f.read()

    # We will search for blocks like:
    # osc.start(...);
    # osc.stop(...);
    # And we'll insert:
    # osc.onended = () => { osc.disconnect(); gain.disconnect(); ... };
    
    # Let's find all instances of `.stop(` and insert the cleanup.
    lines = content.split('\n')
    new_lines = []
    
    for i, line in enumerate(lines):
        new_lines.append(line)
        
        m = re.search(r'^(\s*)([a-zA-Z0-9_]+)\.stop\([^)]+\);', line)
        if m:
            indent = m.group(1)
            var = m.group(2)
            
            # Look backwards to find what nodes this relates to in the same block.
            # We'll just look back up to 20 lines for createGain and createBiquadFilter.
            gain_var = None
            filter_var = None
            for j in range(i, max(-1, i - 25), -1):
                if re.search(r'const\s+([a-zA-Z0-9_]+)\s*=\s*this\.ctx\.createGain\(\)', lines[j]):
                    gain_var = re.search(r'const\s+([a-zA-Z0-9_]+)\s*=\s*this\.ctx\.createGain\(\)', lines[j]).group(1)
                    break
            
            for j in range(i, max(-1, i - 25), -1):
                if re.search(r'const\s+([a-zA-Z0-9_]+)\s*=\s*this\.ctx\.createBiquadFilter\(\)', lines[j]):
                    filter_var = re.search(r'const\s+([a-zA-Z0-9_]+)\s*=\s*this\.ctx\.createBiquadFilter\(\)', lines[j]).group(1)
                    break
            
            # If it's `osc2`, we might just want to disconnect `osc2` because `osc` already disconnects the shared gain/filter.
            # But disconnecting them multiple times doesn't hurt (try/catch can hide errors).
            # Actually, standard JS doesn't throw if you disconnect multiple times, except if it's not connected.
            
            # To match the user's exact instruction: 
            # osc.onended = () => { osc.disconnect(); gain.disconnect(); if (filter) filter.disconnect(); };
            
            if gain_var:
                cleanup = f"{indent}{var}.onended = () => {{ {var}.disconnect(); "
                cleanup += f"{gain_var}.disconnect(); "
                if filter_var:
                    cleanup += f"if ({filter_var}) {filter_var}.disconnect(); "
                cleanup += "};"
                new_lines.append(cleanup)
            else:
                new_lines.append(f"{indent}{var}.onended = () => {{ {var}.disconnect(); }};")

    with open(filepath, 'w') as f:
        f.write('\n'.join(new_lines))

process_file("src/game/audio.ts")
