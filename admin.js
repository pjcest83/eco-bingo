// 1. We must define GAS_URL here just in case backend_sync.js loads late or scope issues occur.
const ADMIN_GAS_URL = "https://script.google.com/macros/s/AKfycbyMFO-rUT-NAprkOijIVExCEsuR_NGxDpQbag7mwoyTQ2NpVx-ac3I_fg0B66fpFN3x/exec";

function openAdminLogin() {
    const pw = prompt("관리자 비밀번호를 입력하세요.");
    if (pw === "830512") {
        document.getElementById('super-admin-modal').classList.remove('hidden');
    } else if (pw !== null) {
        alert("비밀번호가 틀렸습니다.");
    }
}

function closeAdminModal() {
    document.getElementById('super-admin-modal').classList.add('hidden');
}

async function executeAdminDelete() {
    const g = document.getElementById('admin-grade').value;
    const c = document.getElementById('admin-class').value;
    let num = document.getElementById('admin-num').value.trim();
    const name = document.getElementById('admin-name').value.trim();
    
    if(!g || !c || !num || !name) {
        alert("정보를 모두 입력해주세요.");
        return;
    }
    
    // Convert num to number and back to string to remove leading zeros just in case
    num = parseInt(num, 10).toString();
    const targetUserKey = `${g}_${c}_${num}_${name}`;
    
    if (!confirm(`정말로 [${targetUserKey}] 학생의 모든 데이터(서버+로컬)를 삭제하시겠습니까?`)) return;
    
    const btn = document.getElementById('admin-delete-btn');
    btn.innerText = "삭제 중...";
    btn.disabled = true;
    
    try {
        // 1. Local Storage 삭제 (이름이 포함되어 있으면 삭제하는 방식으로 더 강력하게 검사)
        const keysToRemove = [];
        for(let i=0; i<localStorage.length; i++) {
            const k = localStorage.key(i);
            if(k && k.includes(name) && k.includes(`${g}_${c}`)) {
                keysToRemove.push(k);
            }
        }
        keysToRemove.forEach(k => localStorage.removeItem(k));
        
        // 2. IndexedDB 삭제
        if (window.indexedDB) {
            const req = indexedDB.open("EcoBingoDB");
            req.onsuccess = function(e) {
                try {
                    const db = e.target.result;
                    const tx = db.transaction("missions", "readwrite");
                    const store = tx.objectStore("missions");
                    const cursorReq = store.openCursor();
                    
                    cursorReq.onsuccess = function(e2) {
                        const cursor = e2.target.result;
                        if(cursor) {
                            if (cursor.value && cursor.value.userKey && cursor.value.userKey.includes(name)) {
                                cursor.delete();
                            }
                            cursor.continue();
                        }
                    }
                } catch(e) { console.error("IndexedDB clear error", e); }
            };
        }
        
        // 3. Server(GAS) 삭제 요청
        await fetch(ADMIN_GAS_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({
                action: "delete",
                targetUserKey: targetUserKey
            })
        });
        
        alert("해당 학생의 로컬 데이터 및 서버 데이터 삭제 명령이 전송되었습니다.");
        closeAdminModal();
        location.reload();
        
    } catch(err) {
        console.error(err);
        alert("서버 통신 중 오류가 발생했습니다: " + err.message);
    } finally {
        btn.innerText = "이 학생 데이터 완전 삭제";
        btn.disabled = false;
    }
}

async function executeAdminTotalDelete() {
    const confirm1 = confirm("⚠️ 경고 ⚠️\n전교생의 모든 데이터(사진, 글, 빙고도장)가 구글 서버와 현 기기에서 영구 삭제됩니다.\n정말로 진행하시겠습니까?");
    if (!confirm1) return;
    
    const confirm2 = prompt("정말로 삭제하시려면 아래 입력창에 '전체삭제' 라고 입력하세요.");
    if (confirm2 !== "전체삭제") {
        alert("입력이 일치하지 않아 취소되었습니다.");
        return;
    }
    
    const btn = document.getElementById('admin-total-delete-btn');
    btn.innerText = "전체 삭제 중...";
    btn.disabled = true;
    
    try {
        // 1. Local Storage 삭제
        const keysToClear = [];
        for(let i=0; i<localStorage.length; i++) {
            const k = localStorage.key(i);
            if(k && (k.startsWith('bingo_') || k.startsWith('fallback_text_'))) {
                keysToClear.push(k);
            }
        }
        keysToClear.forEach(k => localStorage.removeItem(k));
        
        // 2. IndexedDB 전체 삭제
        if (window.indexedDB) {
            indexedDB.deleteDatabase("EcoBingoDB");
        }
        
        // 3. Server(GAS) 전체 삭제 요청
        await fetch(ADMIN_GAS_URL, {
            method: "POST",
            mode: "no-cors",
            headers: { "Content-Type": "text/plain" },
            body: JSON.stringify({ action: "deleteAll" })
        });
        
        alert("전 교생의 데이터가 전체 초기화되었습니다! 페이지를 새로고침합니다.");
        location.reload();
        
    } catch(err) {
        console.error(err);
        alert("서버 통신 중 오류가 발생했습니다: " + err.message);
        btn.innerText = "전 교생 데이터 전체 초기화";
        btn.disabled = false;
    }
}