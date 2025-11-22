export const locations = {
    college: {
        name: "College Grounds",
        coords: [12.9719, 77.5946], 
        wifiCount: 0,
        checkIns: 0,
        manual: 0,
        history: []
    },
    library: {
        name: "Library",
        coords: [12.9725, 77.5950],
        wifiCount: 0,
        checkIns: 0,
        manual: 0,
        history: []
    },
    canteen: {
        name: "Canteen",
        coords: [12.9710, 77.5940],
        wifiCount: 0,
        checkIns: 0,
        manual: 0,
        history: []
    }
};


export function addSample(loc) {
    const ref = locations[loc];
    const current = Number(ref.wifiCount || 0) + Number(ref.checkIns || 0) + Number(ref.manual || 0);
    ref.history.push(current);
    if (ref.history.length > 20) ref.history.shift();
    return ref.history;
}

export function predictNext(loc) {
    const h = locations[loc].history;
    if (!h || h.length === 0) return 0;
    const slice = h.slice(-5);
    const avg = slice.reduce((a,b)=>a+b,0) / slice.length;
    return Math.round(avg);
}

//
// ⭐ ADD THIS FUNCTION (SAFE, NON-BREAKING)
//
export function addNewLocation(name, coords) {
    locations[name] = {
        name: name,
        coords: coords,
        wifiCount: 0,
        checkIns: 0,
        manual: 0,
        history: []
    };
}
