window.tables = []
window.selectedTable = null
window.selectedTab = null
window.selectedValues = []

function interpolate(distance, dz) {
    const rows = window.selectedValues

    let lower = null, upper = null;

    for (let i = 0; i < rows.length - 1; i++) {
        const d1 = rows[i][0], d2 = rows[i + 1][0];
        if (distance >= d1 && distance <= d2) {
        lower = rows[i];
        upper = rows[i + 1];
        break;
        }
    }

    const isValid = !!(lower && upper);

    if (!isValid) {
        // За пределами таблицы — выдаём граничные значения, но с флагом
        const edge = distance < rows[0][0] ? rows[0] : rows[rows.length - 1];
        return {
        isValid: false,
        elevation: edge[1],
        timeOfFlight: edge[4],
        };
    }

    const d1 = lower[0], d2 = upper[0];
    const t = (distance - d1) / (d2 - d1);

    const elev1 = lower[1], elev2 = upper[1];
    const delev1 = lower[2], delev2 = upper[2];
    const tof1 = lower[4], tof2 = upper[4];

    const baseElev = elev1 + (elev2 - elev1) * t;
    const deltaElev = delev1 + (delev2 - delev1) * t;
    const correction = (dz / 100) * deltaElev;
    const elevation = baseElev - correction;

    const timeOfFlight = tof1 + (tof2 - tof1) * t;

    return {
        isValid: true,
        elevation: +elevation.toFixed(2),
        timeOfFlight: +timeOfFlight.toFixed(2)
    };
}

function calculateAngle(shooter, target) {
    // Разница координат
    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    
    // Математический угол от оси X (восток) в радианах,
    // нормализуем результат в диапазоне [0, 2π)
    const mathAngleRadians = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
    
    // Перевод в градусы, получим угол от востока против часовой стрелки
    const mathAngleDegrees = (mathAngleRadians * (180 / Math.PI)) % 360;
    
    // Пересчитываем в компасный угол: 0° - север, 90° - восток, и т.д.
    // Формула: (90 - угол_от_востока + 360) % 360.
    const bearingDegrees = (90 - mathAngleDegrees + 360) % 360;
    
    // Пересчёт в «тысячные»: 
    // НАТО: 1 градус = 6400/360 тысячных, СССР: 1 градус = 6000/360 тысячных
    const bearingMilNATO = bearingDegrees * (6400 / 360);
    const bearingMilUSSR = bearingDegrees * (6000 / 360);
    
    return {
        angleInRadians: mathAngleRadians,   // угол от востока, в радианах
        angleInMathDegrees: mathAngleDegrees, // угол от востока, в градусах [0,360)
        bearingDegrees,                     // компасный угол (от севера) в градусах [0,360)
        bearingMilNATO,                     // по шкале НАТО [0,6400)
        bearingMilUSSR                      // по шкале СССР [0,6000)
    };
}

function getFireSolution(shooter, target) {
    if (!window.selectedValues.length) return null

    const dx = target.x - shooter.x;
    const dy = target.y - shooter.y;
    const dz = target.z - shooter.z;
  
    const distance = Math.sqrt(dx ** 2 + dy ** 2); // 2D-дистанция
    const angle = calculateAngle(shooter, target);
  
    const interp = interpolate(distance, dz);
  
    return {
      isValid: interp.isValid,
      angleDeg: +angle.bearingDegrees.toFixed(2),
      angleMilNATO: +angle.bearingMilNATO.toFixed(2),
      angleMilUSSR: +angle.bearingMilUSSR.toFixed(2),
      elevation: interp.elevation,
      timeOfFlight: interp.timeOfFlight,
      distance: +distance.toFixed(2),
      heightDifference: +dz.toFixed(2),
    };
}

function calculate() {
    const calculationDiv = document.getElementById('calculation')
    calculationDiv.innerHTML = ''

    const shooter = {
        x: parseInt(document.getElementById('sx').value || 0),
        y: parseInt(document.getElementById('sy').value || 0),
        z: parseInt(document.getElementById('sz').value || 0),
    }

    const target = {
        x: parseInt(document.getElementById('tx').value || 0),
        y: parseInt(document.getElementById('ty').value || 0),
        z: parseInt(document.getElementById('tz').value || 0),
    }

    const solution = getFireSolution(shooter, target)
    console.log({'solution': solution})
    if (!solution) return

    //  isValid: interp.isValid,
    //  angleDeg: +angleDeg.toFixed(2),
    //  angleMilNATO: +angleMilNATO.toFixed(2),
    //  angleMilUSSR: +angleMilUSSR.toFixed(2),
    //  elevation: interp.elevation,
    //  timeOfFlight: interp.timeOfFlight,
    //  distance: +distance.toFixed(2),
    //  heightDifference: +dz.toFixed(2),

    calculationDiv.innerHTML = `
        <b>Valid:</b> ${solution.isValid ? 'Yes' : 'No!!!'}<br>
        <b>angleDeg:</b> ${solution.angleDeg}<br>
        <b>angleMilNATO:</b> ${solution.angleMilNATO}<br>
        <b>angleMilUSSR:</b> ${solution.angleMilUSSR}<br>
        <b>elevation:</b> ${solution.elevation}<br>
        <b>timeOfFlight:</b> ${solution.timeOfFlight}<br>
        <b>distance:</b> ${solution.distance}<br>
        <b>heightDifference:</b> ${solution.heightDifference}<br>
        `
}

function loadValues() {
    const valuesTable = document.getElementById('values')
    valuesTable.innerHTML = ''
    if (!window.selectedTab) return
    const modeSelect = document.getElementById('mode')
    const mode = modeSelect.options[modeSelect.selectedIndex].value
    window.selectedValues = mode === 'high'
        ? window.selectedTab.lines_high
        : window.selectedTab.lines_low
    console.log('loaded values', window.selectedValues)
    window.selectedValues.forEach(values => {
        const tr = document.createElement('tr')
        values.forEach(value => {
            const td = document.createElement('td')
            td.innerHTML = value
            tr.appendChild(td)
        })
        valuesTable.appendChild(tr)
    })
}

function loadTabs() {
    const tabSelect = document.getElementById('tab')
    tabSelect.innerHTML = '<option value="">none</option>'
    window.selectedTable.tabs.forEach((tab, idx) => {
        const option = document.createElement('option')
        option.innerHTML = `${tab.name} (${tab.magazine})`
        option.setAttribute('value', idx)
        tabSelect.appendChild(option)
    });
}

function init() {
    console.log('init')
    const vehicleSelect = document.getElementById('vehicle')

    vehicleSelect.addEventListener('change', () => {
        console.log('table changed')
        const className = vehicleSelect.options[vehicleSelect.selectedIndex].value
        window.selectedTable = null
        window.selectedTab = null
        window.selectedValues = []
        for (const table of window.tables) {
            if (table.class === className) {
                window.selectedTable = table
                loadTabs()
                return
            }
        }
    })

    const tabSelect = document.getElementById('tab')

    tabSelect.addEventListener('change', () => {
        console.log('tab changed')
        const idx = tabSelect.options[tabSelect.selectedIndex].value
        if (!window.selectedTable) return
        window.selectedTab = window.selectedTable.tabs[parseInt(idx)] || null
        window.selectedValues = []
        loadValues()
    })

    const modeSelect = document.getElementById('mode')

    modeSelect.addEventListener('change', () => {
        console.log('mode changed')
        loadValues()
    })

    window.tables.forEach(table => {
        const option = document.createElement('option')
        option.innerHTML = `${table.name} (${table.class})`
        option.setAttribute('value', table.class)
        vehicleSelect.appendChild(option)
    });
}

document.addEventListener('DOMContentLoaded', () => {
    fetch('./tables.json')
        .then((response) => response.json())
        .then((json) => {
            window.tables = json
            init()
        });
})