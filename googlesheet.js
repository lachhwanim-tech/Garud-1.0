async function sendDataToGoogleSheet(data) {
    const primaryAppsScriptUrl = 'https://script.google.com/macros/s/AKfycbzNxn9uEPW4pELZjSl85jzu_KZZ1UBxgXaqSf1TAX_dsNMpOUmlWE5pNWZNwiGMdOxi/exec';
    const otherAppsScriptUrl   = 'https://script.google.com/macros/s/AKfycbzNxn9uEPW4pELZjSl85jzu_KZZ1UBxgXaqSf1TAX_dsNMpOUmlWE5pNWZNwiGMdOxi/exec';
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

    // ================================
    // ✅ SAFE ADDITION (NO SIDE EFFECT)
    // ================================
    // Construct `stops` ONLY if stationStops exists
    let stops = [];
    if (data.stationStops && Array.isArray(data.stationStops) && data.stationStops.length > 0) {
        stops = data.stationStops.map(st => ({
            stopLocation: st.station || 'Unknown',
            kilometer: st.km || st.kilometer || '',
            speedsBefore: Array.isArray(st.speedsBefore) ? st.speedsBefore : [],
            finalSystemAnalysis: st.finalSystemAnalysis || '',
            cliRemark: st.cliRemark || ''
        }));
    }
    // ================================
    // ✅ END SAFE ADDITION
    // ================================

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
    let rakeType = getVal(data.trainDetails, ['Type of Rake', 'Rake']);
    let mps      = getVal(data.trainDetails, ['MPS', 'Max Speed']);

    let lpId   = getVal(data.lpDetails, ['LP ID', 'ID']);
    let lpName = getVal(data.lpDetails, ['LP Name', 'Name']);
    let lpGroup = getVal(data.lpDetails, ['Group', 'HQ']);

    let alpId   = getVal(data.alpDetails, ['ALP ID', 'ID']);
    let alpName = getVal(data.alpDetails, ['ALP Name', 'Name']);
    let alpGroup = getVal(data.alpDetails, ['Group', 'HQ']);

    let maxSpeed = '0', avgSpeed = '0';
    if (data.sectionSpeedSummary && data.sectionSpeedSummary.length > 0) {
        const o = data.sectionSpeedSummary.find(s => s.section.includes('Overall')) || data.sectionSpeedSummary[0];
        maxSpeed = o.maxSpeed || '0';
        avgSpeed = o.averageSpeed || '0';
    }

    let storedHq = localStorage.getItem('currentSessionHq');
    let currentHq = storedHq ? storedHq.toUpperCase() : "UNKNOWN";
    let targetUrl = ALLOWED_HQS.includes(currentHq) ? primaryAppsScriptUrl : otherAppsScriptUrl;

    const payload = {
        dateTime: currentDateTime,
        cliName: getVal(data.trainDetails, ['Analysis By', 'CLI']) || '',
        journeyDate,
        trainNo,
        locoNo,
        fromStn,
        toStn,
        rakeType,
        mps,
        section,

        lpId,
        lpName,
        lpGroupCli: lpGroup,

        alpId,
        alpName,
        alpGroupCli: alpGroup,

        avgSpeed,
        maxSpeed,

        // 🔴 THIS WAS THE ONLY MISSING LINK
        stops: stops
    };

    await fetch(targetUrl, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'data', payload })
    });
}
