async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzNxn9uEPW4pELZjSl85jzu_KZZ1UBxgXaqSf1TAX_dsNMpOUmlWE5pNWZNwiGMdOxi/exec';
    const otherAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzNxn9uEPW4pELZjSl85jzu_KZZ1UBxgXaqSf1TAX_dsNMpOUmlWE5pNWZNwiGMdOxi/exec'; 
    const ALLOWED_HQS = ['BYT', 'R', 'RSD', 'DBEC', 'DURG', 'DRZ', 'MXA', 'BYL', 'BXA', 'AAGH', 'PPYD'];

    console.log("Preparing Clean Payload...");

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
        let result = '';
        if (typeof item === 'object') result = item.value || '';
        else result = String(item).includes(':') ? String(item).split(':')[1] : item;

        return String(result).replace(/["\n\r]/g, '').trim();
    };

    // =====================================================
    // 🔧 ONLY REPAIR FOR DETAILED_STOPS (NO OTHER CHANGE)
    // =====================================================
    // Build data.stops ONLY if stationStops exists
    if (!data.stops && Array.isArray(data.stationStops) && data.stationStops.length > 0) {
        data.stops = data.stationStops.map(st => ({
            stopLocation: st.station || 'Unknown',
            kilometer: st.km || st.kilometer || '',
            speedsBefore: Array.isArray(st.speedsBefore) ? st.speedsBefore : [],
            finalSystemAnalysis: st.finalSystemAnalysis || '',
            cliRemark: st.cliRemark || ''
        }));
    }
    // =====================================================
    // 🔧 END OF REPAIR
    // =====================================================

    const now = new Date();
    const currentDateTime =
        ('0' + now.getDate()).slice(-2) + '/' +
        ('0' + (now.getMonth()+1)).slice(-2) + '/' +
        now.getFullYear() + ' ' +
        ('0' + now.getHours()).slice(-2) + ':' +
        ('0' + now.getMinutes()).slice(-2) + ':' +
        ('0' + now.getSeconds()).slice(-2);

    let fromStn = '', toStn = '';
    if (data.stationStops && data.stationStops.length > 0) {
        fromStn = data.stationStops[0].station || '';
        toStn   = data.stationStops[data.stationStops.length - 1].station || '';
    }

    let journeyDate = getVal(data.trainDetails, ['Journey Date', 'Date']);
    if (!journeyDate) journeyDate = new Date().toLocaleDateString('en-GB');

    let trainNo  = getVal(data.trainDetails, ['Train No', 'Train Number', 'Train']);
    let locoNo   = getVal(data.trainDetails, ['Loco No', 'Loco Number', 'Loco']);
    let section  = getVal(data.trainDetails, ['Section']) || getVal(data.trainDetails, ['Route']);
    let rakeType = getVal(data.trainDetails, ['Type of Rake', 'Rake Type', 'Rake']);
    let mps      = getVal(data.trainDetails, ['Max Permissible', 'MPS', 'Max Speed']);

    let lpId   = getVal(data.lpDetails, ['LP ID', 'ID']);
    let lpName = getVal(data.lpDetails, ['LP Name', 'Name']);
    let lpGroup = getVal(data.lpDetails, ['Group', 'HQ']);

    let alpId   = getVal(data.alpDetails, ['ALP ID', 'ID']);
    let alpName = getVal(data.alpDetails, ['ALP Name', 'Name']);
    let alpGroup = getVal(data.alpDetails, ['Group', 'HQ']);

    let maxSpeed = '0', avgSpeed = '0';
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const overall = data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0];
        maxSpeed = overall.maxSpeed || '0';
        avgSpeed = overall.averageSpeed || '0';
    }

    let storedHq = localStorage.getItem('currentSessionHq');
    let currentHq = storedHq ? storedHq.toString().trim().toUpperCase() : "UNKNOWN";
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

        bftNotDone: document.getElementById('chk-bft-nd')?.checked ? 1 : 0,
        bptNotDone: document.getElementById('chk-bpt-nd')?.checked ? 1 : 0,
        bftRule: document.getElementById('chk-bft-rule')?.checked ? 1 : 0,
        bptRule: document.getElementById('chk-bpt-rule')?.checked ? 1 : 0,
        lateCtrl: document.getElementById('chk-late-ctrl')?.checked ? 1 : 0,
        overspeed: document.getElementById('chk-overspeed')?.checked ? 1 : 0,
        other: document.getElementById('chk-others')?.checked ? 1 : 0,

        totalAbn: Object.values({
            bft_nd: document.getElementById('chk-bft-nd')?.checked ? 1 : 0,
            bpt_nd: document.getElementById('chk-bpt-nd')?.checked ? 1 : 0,
            bft_rule: document.getElementById('chk-bft-rule')?.checked ? 1 : 0,
            bpt_rule: document.getElementById('chk-bpt-rule')?.checked ? 1 : 0,
            late_ctrl: document.getElementById('chk-late-ctrl')?.checked ? 1 : 0,
            overspeed: document.getElementById('chk-overspeed')?.checked ? 1 : 0,
            others: document.getElementById('chk-others')?.checked ? 1 : 0
        }).reduce((a, b) => a + b, 0),

        spare: '',
        uniqueId: `${lpId}_${trainNo}_${journeyDate.replace(/\//g, '-')}`,

        // 🔴 SAME LINE AS BEFORE – now repaired
        stops: data.stops,

        cliHq: currentHq
    };

    await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'data', payload: payload })
    });
}
