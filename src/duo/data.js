/* Course data access.

   course.json is the whole path — sections, 84 units, 528 nodes — and is small
   enough to hold. Unit files carry the phrases, hints and grammar notes and are
   fetched the first time a unit is opened, then kept: a session pulls from
   neighbouring units for its distractors, so the cache earns its keep. */

const url = (file) => new URL(`duo/${file}`, document.baseURI).href;

let coursePromise = null;
const units = new Map();
const unitPromises = new Map();

async function getJson(u) {
  const r = await fetch(u);
  if (!r.ok) throw new Error(`couldn't load ${u.split("/").pop()} (${r.status})`);
  return r.json();
}

export function fetchCourse() {
  if (!coursePromise) {
    coursePromise = getJson(url("course.json")).catch((e) => {
      coursePromise = null;
      throw e;
    });
  }
  return coursePromise;
}

export function fetchUnit(n) {
  if (units.has(n)) return Promise.resolve(units.get(n));
  if (unitPromises.has(n)) return unitPromises.get(n);
  const p = getJson(url(`unit-${String(n).padStart(3, "0")}.json`))
    .then((doc) => {
      units.set(n, doc);
      unitPromises.delete(n);
      return doc;
    })
    .catch((e) => {
      unitPromises.delete(n);
      throw e;
    });
  unitPromises.set(n, p);
  return p;
}

/* Whatever is already in hand — used to widen a word pool without waiting */
export const loadedUnits = () => [...units.values()];
export const peekUnit = (n) => units.get(n) || null;

/* A session wants its own unit plus a few before it, both for review material
   and for distractors that are plausible rather than absurd. */
export async function fetchUnitWindow(n, back = 3) {
  const wanted = [];
  for (let u = Math.max(1, n - back); u <= n; u++) wanted.push(u);
  const docs = await Promise.all(wanted.map((u) => fetchUnit(u).catch(() => null)));
  return docs.filter(Boolean);
}
