from pathlib import Path

main_dir = Path("..")
wetland_dir = Path("../Welands")

token_file = "..\\TOKENS.md"

tokens = {}

def get_tokens(dir):
    global tokens

    new_tokens = {}
    for token, value in tokens.items():
        if token[1] != "*":
            new_tokens["\\*" + token] = value
        else:
            new_tokens[token] = value
    tokens = new_tokens.copy()

    for file in dir.rglob("*.md"):
        if file.is_file():
            if file._raw_path == token_file:
                continue
            text = file.read_text(encoding="utf-8")
            text = text.split()
            for word in text:
                if "{" in word:
                    start_idx = word.index("{")
                    end_idx = word.index("}")

                    token = word[start_idx+1:end_idx]

                    if not token in tokens.keys() and not "\\*" + token in tokens.keys():
                        tokens[token] = "-"
                    else:
                        if "\\*" + token in tokens.keys():
                            value = tokens["\\*" + token]
                            del tokens["\\*" + token]
                            tokens[token] = value
    write_tokens()

def read_tokens():
    global tokens

    with open(token_file, encoding= "utf8", mode= "r") as fd:
        for entry in fd:
            if entry == "\n":
                continue
            data = entry.split(":")
            token = data[0].strip()
            value = data[1].strip()

            tokens[token] = value

def write_tokens():
    with open(token_file, encoding= "utf8", mode= "w") as fd:
        for token, value in tokens.items():
            fd.write(f"{token} : {value}\n")


read_tokens()
get_tokens(main_dir)