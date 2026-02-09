async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzNxn9uEPW4pELZjSl85jzu_KZZ1UBxgXaqSf1TAX_dsNMpOUmlWE5pNWZNwiGMdOxi/exec';
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzNxn9uEPW4pELZjSl85jzu_KZZ1UBxgXaqSf1TAX_dsNMpOUmlWE5pNWZNwiGMdOxi/exec'; 
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Preparing Clean Payload...");
    
    // Debugging: Check if stops data exists before sending
    console.log("Stops data found in local storage:", data.stops ? data.stops.length : 0);

    const getVal = (arr, labels) => {
        if (!arr || !Array.isArray(arr)) return '';
        const searchLabels = Array.isArray(labels) ? labels : [labels];
        const clean = (str) => String(str || '').replace(/["\n\r]/g, '').trim().toLowerCase();

        const item = arr.find(d => {
            if (!d) return false;
            if (typeof d === 'object' && d.label) {
                const cleanLabel = clean(d.label);
                return searchLabels.some(l => cleanLabel.includes(clean(l)));
            }
            return searchLabels.some(l => clean(d).includes(clean(l)));
        });

        if (!item) return '';
        let result = typeof item === 'object' ? (item.value || '') : String(item);
        if (typeof item !== 'object' && result.includes(':')) result = result.split(':')[1];
        return String(result).replace(/["\n\r]/g, '').trim();
    };

    const now = new Date();
    const currentDateTime = ('0' + now.getDate()).slice(-2) + '/' + ('0' + (now.getMonth()+1)).slice(-2) + '/' + now.getFullYear() + ' ' + ('0' + now.getHours()).slice(-2) + ':' + ('0' + now.getMinutes()).slice(-2) + ':' + ('0' + now.getSeconds()).slice(-2);

    let fromStn = '', toStn = '';
    if (data.stationStops && data.stationStops.length > 0) {
        fromStn = data.stationStops[0].station || '';
        toStn = data.stationStops[data.stationStops.length - 1].station || '';
    }
    if (!fromStn || !toStn) {
        const route = getVal(data.trainDetails, ['Route', 'Section']);
        if (route && route.includes('-')) {
            const parts = route.split('-');
            fromStn = fromStn || parts[0].trim();
            toStn = toStn || parts[1].trim();
        }
    }

    let journeyDate = getVal(data.trainDetails, ['Journey Date', 'Date']);
    if (!journeyDate || journeyDate.length < 6) {
        const dateItem = data.trainDetails.find(d => {
            const val = typeof d === 'object' ? d.value : String(d);
            return val && val.match(/\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4}/);
        });
        if (dateItem) {
            const val = typeof dateItem === 'object' ? dateItem.value : String(dateItem);
            const matches = val.match(/(\d{1,2}[\/-]\d{1,2}[\/-]\d{2,4})/);
            if (matches) journeyDate = matches[0];
        }
    }
    if (!journeyDate) journeyDate = new Date().toLocaleDateString('en-GB');

    let trainNo = getVal(data.trainDetails, ['Train No', 'Train Number', 'Train']);
    let locoNo = getVal(data.trainDetails, ['Loco No', 'Loco Number', 'Loco']) || (data.trainDetails[0]?.value || '');
    let section = getVal(data.trainDetails, ['Section']) || getVal(data.trainDetails, ['Route']);
    let rakeType = getVal(data.trainDetails, ['Type of Rake', 'Rake Type', 'Rake']);
    let mps = getVal(data.trainDetails, ['Max Permissible', 'MPS', 'Max Speed']);

    let lpId = getVal(data.lpDetails, ['LP ID', 'ID']), lpName = getVal(data.lpDetails, ['LP Name', 'Name']), lpGroup = getVal(data.lpDetails, ['Group', 'HQ']);
    let alpId = getVal(data.alpDetails, ['ALP ID', 'ID']), alpName = getVal(data.alpDetails, ['ALP Name', 'Name']), alpGroup = getVal(data.alpDetails, ['Group', 'HQ']);

    let maxSpeed = '0', avgSpeed = '0';
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const overall = data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0];
        maxSpeed = overall.maxSpeed || '0';
        avgSpeed = overall.averageSpeed || '0';
    }

    const abn = {
        bft_nd: document.getElementById('chk-bft-nd')?.checked ? 1 : 0,
        bpt_nd: document.getElementById('chk-bpt-nd')?.checked ? 1 : 0,
        bft_rule: document.getElementById('chk-bft-rule')?.checked ? 1 : 0,
        bpt_rule: document.getElementById('chk-bpt-rule')?.checked ? 1 : 0,
        late_ctrl: document.getElementById('chk-late-ctrl')?.checked ? 1 : 0,
        overspeed: document.getElementById('chk-overspeed')?.checked ? 1 : 0,
        others: document.getElementById('chk-others')?.checked ? 1 : 0
    };

    const abnStrings = [];
    if (abn.bft_nd) abnStrings.push("BFT not done");
    if (abn.bpt_nd) abnStrings.push("BPT not done");
    if (abn.bft_rule) abnStrings.push(`BFT Rule: ${document.getElementById('txt-bft-rule')?.value.trim()}`);
    if (abn.bpt_rule) abnStrings.push(`BPT Rule: ${document.getElementById('txt-bpt-rule')?.value.trim()}`);
    if (abn.late_ctrl) abnStrings.push(`Late Ctrl: ${document.getElementById('txt-late-ctrl')?.value.trim()}`);
    if (abn.overspeed) abnStrings.push(`Overspeed: ${document.getElementById('txt-overspeed')?.value.trim()}`);
    if (abn.others) abnStrings.push(`Other: ${document.getElementById('txt-others')?.value.trim()}`);
    const fullAbnormalityText = abnStrings.join('; ') || 'NIL';

    let storedHq = localStorage.getItem('currentSessionHq');
    let currentHq = (storedHq || document.getElementById('cliHqDisplay')?.value || "UNKNOWN").toString().trim().toUpperCase();
    let targetUrl = ALLOWED_HQS.includes(currentHq) ? primaryAppsScriptUrl : otherAppsScriptUrl;

    const payload = {
        dateTime: currentDateTime,
        cliName: getVal(data.trainDetails, ['Analysis By', 'CLI']) || data.cliName || '',
        journeyDate: journeyDate,
        trainNo: trainNo,
        locoNo: locoNo,
        fromStn: fromStn,
        toStn: toStn,
        rakeType: rakeType,
        mps: mps,
        section: section,
        lpId: lpId,
        lpName: lpName,
        lpGroupCli: lpGroup,
        alpId: alpId,
        alpName: alpName,
        alpGroupCli: alpGroup,
        bftStatus: data.bftDetails?.time ? "Done" : "Not done",
        bptStatus: data.bptDetails?.time ? "Done" : "Not done",
        overspeedCount: data.overSpeedDetails ? data.overSpeedDetails.length : 0,
        totalDist: data.speedRangeSummary?.totalDistance || '0',
        avgSpeed: avgSpeed,
        maxSpeed: maxSpeed,
        cliObs: document.getElementById('cliRemarks')?.value.trim() || 'NIL',
        actionTaken: document.querySelector('input[name="actionTakenRadio"]:checked')?.value || 'NIL',
        bftNotDone: abn.bft_nd,
        bptNotDone: abn.bpt_nd,
        bftRule: abn.bft_rule,
        bptRule: abn.bpt_rule,
        lateCtrl: abn.late_ctrl,
        overspeed: abn.overspeed,
        other: abn.others,
        totalAbn: Object.values(abn).reduce((a, b) => a + b, 0),
        uniqueId: `${lpId}_${trainNo}_${journeyDate.replace(/\//g, '-')}`,
        stops: data.stops || [], // Explicitly ensuring this is sent
        abnormalityText: fullAbnormalityText,
        cliHq: currentHq
    };

    try {
        await fetch(targetUrl, {
            method: 'POST',
            mode: 'no-cors', 
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ type: 'data', payload: payload })
        });
        console.log('Data sent successfully.');
    } catch (error) {
        console.error('Submission Error:', error);
        alert('Network Error: Data could not be saved to Sheet.');
        throw error;
    }
}
