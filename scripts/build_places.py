"""Builds public/data/places.json: every town of 15,000+ people worldwide, for the skin weather
town picker. Source: GeoNames (CC BY 4.0, https://www.geonames.org), cities15000, admin1 codes and
country info. The phone searches this file itself; nothing typed leaves the device.

Usage: python3 scripts/build_places.py <folder with cities15000.txt, admin1.txt, countryInfo.txt>
"""
import json
import os
import sys

src = sys.argv[1]
countries = {}
for line in open(os.path.join(src, "countryInfo.txt"), encoding="utf-8"):
    if line.startswith("#"):
        continue
    cols = line.rstrip("\n").split("\t")
    if len(cols) > 4:
        countries[cols[0]] = cols[4]
admin1 = {}
for line in open(os.path.join(src, "admin1.txt"), encoding="utf-8"):
    cols = line.rstrip("\n").split("\t")
    if len(cols) >= 2:
        admin1[cols[0]] = cols[1]
rows = []
for line in open(os.path.join(src, "cities15000.txt"), encoding="utf-8"):
    c = line.rstrip("\n").split("\t")
    name, ascii_name, lat, lon, cc, a1, pop = c[1], c[2], float(c[4]), float(c[5]), c[8], c[10], int(c[14] or 0)
    region = admin1.get(f"{cc}.{a1}", "")
    # Two decimals (about 1 km): enough for weather, and all the forecast ever needs to know.
    rows.append((pop, [name, ascii_name if ascii_name != name else "", region, cc, round(lat, 2), round(lon, 2)]))
rows.sort(key=lambda r: -r[0])
out = {
    "source": "GeoNames cities15000 (CC BY 4.0), https://www.geonames.org",
    "countries": countries,
    "places": [r[1] for r in rows],
}
path = os.path.join(os.path.dirname(os.path.abspath(__file__)), "..", "public", "data", "places.json")
json.dump(out, open(path, "w", encoding="utf-8"), ensure_ascii=False, separators=(",", ":"))
print(f"{len(rows)} places in {len(countries)} countries -> {os.path.getsize(path) / 1e6:.1f} MB")
