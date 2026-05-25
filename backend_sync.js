const GAS_URL = "https://script.google.com/macros/s/AKfycby72u7c4_V2tXzUd98K1EyJLBgOKlwtXwoSdUGBJ2cGTULA4nMvpDgveVJyYWEm72xD/exec";
const DB_NAME = "EcoBingoDB";
const DB_VERSION = 1;
const STORE_NAME = "missions";

let db = null;
const request = indexedDB.open(DB_NAME, DB_VERSION);

request.onupgradeneeded = (e) => {
    db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
    }
};

request.onsuccess = (e) => {
    db = e.target.result;
};

async function saveMissionToIndexedDB(userKey, missionNum, text, imageBase64) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("DB not initialized");
        const tx = db.transaction([STORE_NAME], "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const missionId = userKey + "_" + missionNum;
        const data = { id: missionId, userKey, missionNum, text, image: imageBase64, timestamp: Date.now() };
        const req = store.put(data);
        req.onsuccess = () => resolve(true);
        req.onerror = (err) => reject(err);
    });
}

function getMissionFromIndexedDB(userKey, missionNum) {
    return new Promise((resolve) => {
        if (!db) return resolve(null);
        const tx = db.transaction([STORE_NAME], "readonly");
        const store = tx.objectStore(STORE_NAME);
        const missionId = userKey + "_" + missionNum;
        const req = store.get(missionId);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => resolve(null);
    });
}

async function submitMissionToBackend(userKey, missionNum, text, imageBase64) {
    // 1. Save locally so it appears when they re-open the cell
    try {
        localStorage.setItem("fallback_text_" + userKey + "_" + missionNum, text);
        await saveMissionToIndexedDB(userKey, missionNum, text, imageBase64);
    } catch(e) {
        console.warn("Local cache save skipped due to browser rules.");
    }
    
    // 2. FORCE DIRECT SEND TO GOOGLE SCRIPT!
    try {
        await fetch(GAS_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ 
                userKey: userKey, 
                missionNum: missionNum, 
                text: text, 
                image: imageBase64 
            })
        });
        console.log("Mission", missionNum, "sent successfully to GAS");
        return true;
    } catch (e) {
        console.error("Failed to send to GAS:", e);
        return false;
    }
}