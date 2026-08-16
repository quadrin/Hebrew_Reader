#!/usr/bin/env python3
"""Harvest the Hebrew course sentence bank from Duolingo's own session API.

Duolingo keeps the ~8,305 sentences server-side. Nothing public exposes them.
The only complete route is to ask for lessons the way the app does, with your
own account's token, and keep what comes back.

    WHAT YOU NEED
      * Python 3.8 or newer. No packages to install — standard library only.
      * 04_path_levels.csv, from the same bundle as this script. Keep the two
        files in the same folder.
      * A Duolingo account with Hebrew (from English) as the active course.

    HOW TO GET A TOKEN
      1. Log in at duolingo.com in a browser.
      2. Open DevTools -> Application -> Cookies -> https://www.duolingo.com
      3. Copy the value of the `jwt_token` cookie. It starts with `eyJ` and has
         two dots in it. Copy the value only, not `jwt_token=`.
      4. export DUOLINGO_JWT='eyJhbGci...'          (Windows PowerShell:
         $env:DUOLINGO_JWT='eyJhbGci...')

    RUN
      python3 harvest_sentences.py --dry-run              # check the setup
      python3 harvest_sentences.py --units 1-1 --repeats 1 --debug   # one unit
      python3 harvest_sentences.py --units 1-84 --repeats 3          # the lot

    The token expires. If calls start returning 401, log in again and recopy it.

    WHAT IT DOES
      For each unit it starts lesson sessions the same way the app does and
      records every sentence in the returned challenges. Duolingo samples the
      challenges, so the same unit gives different sentences each time; repeat
      passes until new sentences stop appearing.

    BEFORE YOU RUN IT
      * These are real session starts on your account. They can affect XP,
        streak and progress data.
      * Automated bulk access is against Duolingo's terms of service. This is
        for your own account and your own data; keep the rate low and the
        volume modest.
      * The script never sends your token anywhere except duolingo.com.
"""
import argparse, csv, json, os, random, re, sys, time
import urllib.error, urllib.request

API = "https://www.duolingo.com/2017-06-30"
HEB = re.compile(r"[֐-׿]")
HERE = os.path.dirname(os.path.abspath(__file__))
LEVELS_NAME = "04_path_levels.csv"


def find_levels_csv():
    """04_path_levels.csv may sit beside the script, in ./out, or in the cwd."""
    for cand in (os.path.join(HERE, LEVELS_NAME),
                 os.path.join(HERE, "out", LEVELS_NAME),
                 os.path.join(os.getcwd(), LEVELS_NAME),
                 os.path.join(os.getcwd(), "out", LEVELS_NAME)):
        if os.path.exists(cand):
            return cand
    sys.exit(f"Cannot find {LEVELS_NAME}. Put it next to this script "
             f"(it ships in the same bundle) and rerun.")


def call(path, token, method="GET", body=None):
    data = json.dumps(body).encode() if body is not None else None
    req = urllib.request.Request(
        f"{API}{path}", data=data, method=method,
        headers={
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
            "User-Agent": "Mozilla/5.0",
        })
    with urllib.request.urlopen(req, timeout=45) as r:
        return json.loads(r.read())


def me(token):
    """Resolve the user ID out of the JWT, then fetch the course state."""
    import base64
    payload = token.split(".")[1]
    payload += "=" * (-len(payload) % 4)
    uid = json.loads(base64.urlsafe_b64decode(payload))["sub"]
    return uid, call(f"/users/{uid}?fields=currentCourse,fromLanguage,learningLanguage", token)


def walk_sentences(node, found, ctx=""):
    """Pull every Hebrew/English pair out of a challenge blob, schema-agnostic."""
    if isinstance(node, dict):
        prompt = node.get("prompt") or node.get("text") or node.get("sentence")
        sols = node.get("correctSolutions") or []
        if isinstance(sols, str):
            sols = [sols]
        meta = node.get("metadata") or {}
        alt = meta.get("solution_key") or meta.get("sentence_id") or ""
        if prompt and isinstance(prompt, str):
            he = prompt if HEB.search(prompt) else ""
            en = "" if he else prompt
            for s in sols:
                if not isinstance(s, str):
                    continue
                if HEB.search(s):
                    he = he or s
                else:
                    en = en or s
            if he or en:
                found.add((he, en, str(alt), node.get("type", ctx) or ""))
        for k, v in node.items():
            walk_sentences(v, found, node.get("type", ctx) or ctx)
    elif isinstance(node, list):
        for v in node:
            walk_sentences(v, found, ctx)


def load_targets(units_arg):
    lo, hi = (int(x) for x in units_arg.split("-")) if "-" in units_arg \
        else (int(units_arg), int(units_arg))
    levels = list(csv.DictReader(open(find_levels_csv(), encoding="utf-8-sig")))
    targets = []
    for l in levels:
        if l["type"] != "skill" or not l["skill_id"]:
            continue
        u = int(l["unit"])
        if lo <= u <= hi:
            targets.append({
                "unit": u,
                "skill_id": l["skill_id"],
                "crown": int(l["crown_level"] or 0),
                "name": l["debug_name"],
            })
    return targets


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--units", default="1-84")
    ap.add_argument("--repeats", type=int, default=3,
                    help="passes over each unit; sentences are sampled, so repeats add coverage")
    ap.add_argument("--delay", type=float, default=2.5, help="seconds between requests")
    ap.add_argument("--out", default=os.path.join(HERE, "sentence_bank.csv"))
    ap.add_argument("--dry-run", action="store_true",
                    help="check Python version, the CSV and the token format, then stop")
    ap.add_argument("--debug", action="store_true",
                    help="save the first raw session response to debug_session.json")
    args = ap.parse_args()

    print(f"python {sys.version.split()[0]}")
    levels_csv = find_levels_csv()
    print(f"levels file: {levels_csv}")
    targets_preview = load_targets(args.units)
    print(f"units {args.units}: {len(targets_preview)} skill levels to request")

    token = os.environ.get("DUOLINGO_JWT", "").strip().strip('"').strip("'")
    if not token:
        sys.exit("\nDUOLINGO_JWT is not set — see the instructions at the top of this file.")
    if token.count(".") != 2:
        sys.exit("\nDUOLINGO_JWT does not look like a JWT (expected three dot-separated parts). "
                 "Copy the value of the jwt_token cookie, not the whole cookie string.")
    if args.dry_run:
        try:
            uid, _ = me(token)
            print(f"token parses, user id {uid}")
        except urllib.error.HTTPError as e:
            sys.exit(f"token rejected by Duolingo ({e.code}) — log in again and recopy it")
        print("\nSetup looks fine. Drop --dry-run to start harvesting.")
        return

    uid, prof = me(token)
    course = prof.get("currentCourse") or {}
    print(f"user {uid} | course {course.get('id')} "
          f"({course.get('fromLanguage')}->{course.get('learningLanguage')}) "
          f"| sentences reported: {course.get('numberOfSentences')}")
    if course.get("learningLanguage") != "he":
        print("WARNING: your active course is not Hebrew. Switch it in the app first.")

    targets = load_targets(args.units)
    print(f"{len(targets)} skill levels in range, {args.repeats} passes each\n")

    found, rows, fails = set(), [], 0
    seen_before = 0
    for rep in range(1, args.repeats + 1):
        random.shuffle(targets)
        for i, t in enumerate(targets, 1):
            body = {
                "challengeTypes": ["assist", "characterIntro", "characterMatch", "characterSelect",
                                   "completeReverseTranslation", "definition", "dialogue",
                                   "form", "freeResponse", "gapFill", "judge", "listen",
                                   "listenComplete", "listenMatch", "listenTap", "match",
                                   "name", "listenComprehension", "partialListen",
                                   "partialReverseTranslate", "readComprehension",
                                   "select", "selectPronunciation", "selectTranscription",
                                   "speak", "syllableTap", "tapCloze", "tapComplete",
                                   "tapDescribe", "translate", "typeCloze", "typeComplete"],
                "fromLanguage": "en",
                "learningLanguage": "he",
                "isFinalLevel": False,
                "isV2": True,
                "juicy": True,
                "smartTipsVersion": 2,
                "levelIndex": t["crown"],
                "skillId": t["skill_id"],
                "type": "LESSON",
            }
            try:
                res = call("/sessions", token, "POST", body)
                if args.debug and rep == 1 and i == 1:
                    dbg = os.path.join(HERE, "debug_session.json")
                    json.dump(res, open(dbg, "w"), ensure_ascii=False, indent=1)
                    print(f"  wrote raw response to {dbg}")
                before_n = len(found)
                walk_sentences(res.get("challenges") or res, found)
                if i == 1 and rep == 1 and len(found) == before_n:
                    print("  WARNING: the first session returned no sentences. Duolingo may have "
                          "changed the response shape — rerun with --debug and check the JSON.")
            except urllib.error.HTTPError as e:
                fails += 1
                print(f"  [{e.code}] unit {t['unit']} {t['name']}", flush=True)
                if e.code in (401, 403):
                    print("  token rejected — refresh DUOLINGO_JWT and rerun")
                    break
                time.sleep(5)
            except Exception as e:
                fails += 1
                print(f"  [{type(e).__name__}] unit {t['unit']}", flush=True)
            if i % 20 == 0:
                print(f"  pass {rep}: {i}/{len(targets)} units, {len(found)} sentences",
                      flush=True)
            time.sleep(args.delay)
        gained = len(found) - seen_before
        seen_before = len(found)
        print(f"pass {rep} done: {len(found)} unique sentences (+{gained})\n", flush=True)
        if gained < 20 and rep > 1:
            print("new sentences have dried up; stopping early")
            break

    rows = [{"hebrew": h, "english": e, "solution_key": k, "challenge_type": c}
            for (h, e, k, c) in sorted(found)]
    with open(args.out, "w", newline="", encoding="utf-8-sig") as f:
        w = csv.DictWriter(f, fieldnames=["hebrew", "english", "solution_key", "challenge_type"])
        w.writeheader()
        w.writerows(rows)
    both = sum(1 for r in rows if r["hebrew"] and r["english"])
    print(f"\nwrote {len(rows)} rows to {args.out} ({both} with both languages, {fails} failed calls)")


if __name__ == "__main__":
    main()
