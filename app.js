class Position2D {
    /** @type {number} */
    x;

    /** @type {number} */
    y;

    /**
     * @param {number} x
     * @param {number} y
     */
    constructor(x, y) {
        this.x = x;
        this.y = y;
    }

    /**
     * @param {Position2D} a
     * @param {Position2D} b
     * @returns {number}
     */
    static distance(a, b) {
        return Math.hypot(a.x - b.x, a.y - b.y)
    }

    /**
     * @param {Position2D} from
     * @param {Position2D} to
     * @returns {Azimuth}
     */
    static azimuth(from, to) {
        const dx = to.x - from.x;
        const dy = to.y - from.y;

        const mathAngleRadians = (Math.atan2(dy, dx) + 2 * Math.PI) % (2 * Math.PI);
        const mathAngleDegrees = (mathAngleRadians * (180 / Math.PI)) % 360;

        return new Azimuth((90 - mathAngleDegrees + 360) % 360);
    }

    /**
     * @param {Position2D} other
     * @returns {number}
     */
    distanceTo(other) {
        return Position2D.distance(this, other);
    }

    /**
     * @param {Position2D} other
     * @returns {Azimuth}
     */
    azimuthTo(other) {
        return Position2D.azimuth(this, other);
    }
}

class Azimuth {
    /** @type {number} */
    #degrees;

    /**
     * @param {number} degrees 
     */
    constructor(degrees) {
        this.#degrees = degrees % 360;
    }

    /**
     * @param {number} mil 
     * @returns {Azimuth}
     */
    static fromMilNATO(mil) {
        return new Azimuth((mil / 6400) * 360);
    }

    /**
     * @param {number} mil 
     * @returns {Azimuth}
     */
    static fromMilUSSR(mil) {
        return new Azimuth((mil / 6000) * 360);
    }

    /**
     * @returns {number}
     */
    get degrees() {
        return Math.round(this.#degrees);
    }

    /**
     * @returns {number}
     */
    get milNATO() {
        return Math.round(this.#degrees * (6400 / 360));
    }

    /**
     * @returns {number}
     */
    get milUSSR() {
        return Math.round(this.#degrees * (6000 / 360));
    }
}

class TableTabRow {
    /** @type {Array<number>} */
    #values;

    /** @type {number} Range, in meters */
    range;

    /** @type {number} Elevation, in milliradians */
    elev;

    /** @type {number} Δ-Elevation per 100m (DR), in milliradians */
    deltaElev;

    /** @type {number} Δ-Time of flight per 100m (DR), in seconds */
    deltaFlightTime;

    /** @type {number} Time of flight, in seconds */
    flightTime;

    /** @type {number} Azimuth correction for 1m/s crosswind, in milliradians */
    azimuthCorrectionCrosswind;

    /** @type {number} Range correction for head 1m/s wind, in (M?) */
    rangeCorrectionWindHead;

    /** @type {number} Range correction for tail 1m/s wind, in (M?) */
    rangeCorrectionWindTail;

    /** @type {number} Range correction for 1° decreasing Δ air temp from 15°, in (M?) */
    rangeCorrectionTempDec;

    /** @type {number} Range correction for 1° increasing Δ air temp from 15°, in (M?) */
    rangeCorrectionTempInc;

    /** @type {number} Range correction for decreasing Δ air density from 1pct, in (M?) */
    rangeCorrectionDensityDec;

    /** @type {number} Range correction for increasing Δ air density from 1pct, in (M?) */
    rangeCorrectionDensityInc;

    /**
     * @param {Array<number>} values 
     */
    constructor(values) {
        this.#values = values;
        this.range = values[0];
        this.elev = values[1];
        this.deltaElev = values[2];
        this.deltaFlightTime = values[3];
        this.flightTime = values[4];
        this.azimuthCorrectionCrosswind = values[5];
        this.rangeCorrectionWindHead = values[6];
        this.rangeCorrectionWindTail = values[7];
        this.rangeCorrectionTempDec = values[8];
        this.rangeCorrectionTempInc = values[9];
        this.rangeCorrectionDensityDec = values[10];
        this.rangeCorrectionDensityInc = values[11];
    }

    get values() {
        return this.#values;
    }
}

class TableTab {
    /** @type {string} Tab name */
    name;

    /** @type {string} Tab magazine */
    magazine;

    /** @type {Array<TableTabRow>} Rows for high trajectory */
    highRows;

    /** @type {Array<TableTabRow>} Rows for low trajectory */
    lowRows;

    /**
     * @param {Array} values 
     */
    constructor(values) {
        this.name = values[0];
        this.magazine = values[1];
        this.highRows = values[2].map(rowValues => new TableTabRow(rowValues));
        this.lowRows = values[3].map(rowValues => new TableTabRow(rowValues));
    }
}

class Table {
    /** @type {string} Vehicle classname */
    vehicleClassName;

    /** @type {string} Vehicle display name */
    vehicleName;

    /** @type {Array<TableTab>} Tabs */
    tabs;

    /**
     * @param {Array} values 
     */
    constructor(values) {
        this.vehicleClassName = values[0];
        this.vehicleName = values[1];
        this.tabs = values[2].map(tabValues => new TableTab(tabValues));
    }
}

// CALCULATION \\\

function findSolution(distance, zOffset) {
    const rows = getRows();

    let lower = null, upper = null;

    for (let i = 0; i < rows.length; i++) {
        const currRow = rows[i];
        const nextRow = rows[i + 1] || null;
        
        if (distance < currRow.range) {
            return null;
        }

        if (currRow.range === distance) {
            lower = currRow;
            upper = currRow;
            break;
        }

        if (!nextRow) {
            return null;
        }

        if (currRow.range <= distance && nextRow.range > distance) {
            lower = currRow;
            upper = nextRow;
            break;
        }
    }

    if (!lower && !upper) {
        return null;
    }

    const weather = weatherForm();

    console.log({lower, upper});

    const multiplier = upper.range !== lower.range
        ? (distance - lower.range) / (upper.range - lower.range)
        : 0;
    const zMultiplier = zOffset / 100;

    const baseElev = lower.elev + (upper.elev - lower.elev) * multiplier;
    const baseTime = lower.flightTime + (upper.flightTime - lower.flightTime) * multiplier;
    const deltaElev = lower.deltaElev + (upper.deltaElev - lower.deltaElev) * multiplier;
    const deltaTime = lower.deltaFlightTime + (upper.deltaFlightTime - lower.deltaFlightTime) * multiplier;

    const elev = Math.round(baseElev - zMultiplier * deltaElev);
    const time = Math.round(baseTime - zMultiplier * deltaTime);

    // console.log({
    //     multiplier,
    //     zMultiplier,
    //     baseElev,
    //     baseTime,
    //     deltaElev,
    //     deltaTime,
    // });

    return {elev, time};
}

/**
 * @param {number} distance 
 * @param {Azimuth} azimuth 
 * @param {number} zOffset 
 */
function calculate(distance, azimuth, zOffset) {
    console.log('calculating', {distance, azimuth, zOffset});

    const solution = findSolution(distance, zOffset);

    console.log('calculated solution', solution);

    const resultInput = document.getElementById('results');
    const resultCompactInput = document.getElementById('results-compact');
    resultInput.value = '';
    resultCompactInput.value = '';

    if (!solution) return;

    const results = {
        distance: distance,
        degrees: azimuth.degrees,
        NATO: String(azimuth.milNATO).padStart(4, '0'),
        USSR: String(azimuth.milUSSR).padStart(4, '0'),
        elevation: String(solution.elev).padStart(4, '0'),
        time: solution.time,
        charge: extractChargeNumber(window.selectedTab.name),
    };

    resultInput.value = `A: ${results.NATO} - E: ${results.elevation} - C: ${results.charge} - D: ${results.distance} m. - T: ${results.time} s.`;
    resultCompactInput.value = `A${results.NATO} E${results.elevation} C${results.charge} D${results.distance}`;
}

function calculateAbsolute() {
    const input = absoluteForm();
    const sourcePos = new Position2D(input.absXsource, input.absYsource);
    const targetPos = new Position2D(input.absXtarget, input.absYtarget);
    const distance = sourcePos.distanceTo(targetPos);
    const azimuth = sourcePos.azimuthTo(targetPos);
    const zOffset = input.absZtarget - input.absZsource;

    calculate(distance, azimuth, zOffset);
}

function calculateRelative() {
    const input = relativeForm();
    const distance = input.relDistance;
    const azimuth = Azimuth.fromMilNATO(input.relAzimuth);
    const zOffset = input.relZtarget - input.relZsource;

    calculate(distance, azimuth, zOffset);
}

function extractChargeNumber(input) {
    const match = input.match(/\[Charge (\d+)]/);
    return match ? match[1] : null;
  }

// CALCULATION ///

// FRONT-END \\\

function absoluteForm() {
    return {
        absXsource: parseInt(document.getElementById('absXsource').value || 0),
        absYsource: parseInt(document.getElementById('absYsource').value || 0),
        absZsource: parseInt(document.getElementById('absZsource').value || 0),
        absXtarget: parseInt(document.getElementById('absXtarget').value || 0),
        absYtarget: parseInt(document.getElementById('absYtarget').value || 0),
        absZtarget: parseInt(document.getElementById('absZtarget').value || 0),
    }
}

function relativeForm() {
    return {
        relDistance: parseInt(document.getElementById('relDistance').value || 0),
        relAzimuth: parseInt(document.getElementById('relAzimuth').value || 0),
        relZsource: parseInt(document.getElementById('relZsource').value || 0),
        relZtarget: parseInt(document.getElementById('relZtarget').value || 0),
    }
}

function weatherForm() {
    return {
        temperature: parseInt(document.getElementById('temperature').value || 15),
        density: parseInt(document.getElementById('density').value || 1),
        windSpeed: parseInt(document.getElementById('wind-speed').value || 0),
        windDirection: parseInt(document.getElementById('wind-direction').value || 0),
    }
}

function fillTable() {
    const tBody = document.getElementById('fire-table-body');
    tBody.innerHTML = '';

    getRows().forEach(row => {
        const tRow = document.createElement('tr');
        row.values.forEach(val => {
            const tData = document.createElement('td');
            tData.innerHTML = val;
            tRow.appendChild(tData);
        })
        tBody.appendChild(tRow);
    });
}

function fillCharges() {
    const chargeSelect = document.getElementById('charge');
    chargeSelect.innerHTML = '';

    if (!window.selectedTable) return;

    window.selectedTable.tabs.forEach((tab, i) => {
        const option = document.createElement('option');
        option.value = i;
        option.innerHTML = tab.name.trim();
        if (tab.magazine.length) option.innerHTML = option.innerHTML + ` @ ${tab.magazine}`;
        chargeSelect.appendChild(option);
    });

    onChargeChange();
}

function fillWeapons() {
    const weaponSelect = document.getElementById('weapon');
    weaponSelect.innerHTML = '';

    window.tables.forEach(table => {
        const option = document.createElement('option');
        option.value = table.vehicleClassName;
        option.innerHTML = `${table.vehicleName} @ ${table.vehicleClassName}`;
        weaponSelect.appendChild(option);
    });

    onWeaponChange();
}

function onModeChange() {
    const modeSelect = document.getElementById('mode');
    const value = modeSelect.options[modeSelect.selectedIndex].value;
    setMode(1 === parseInt(value));
    fillTable();
}

function onChargeChange() {
    const chargeSelect = document.getElementById('charge');

    if (!chargeSelect.options.length) {
        selectTab(null);
        return;
    }

    const index = chargeSelect.options[chargeSelect.selectedIndex].value;
    selectTab(index);
    fillTable();
}

function onWeaponChange() {
    const weaponSelect = document.getElementById('weapon');
    const vehicleClassName = weaponSelect.options[weaponSelect.selectedIndex].value;
    selectTable(vehicleClassName);
    fillCharges();
}

function addEventListeners() {
    const weaponSelect = document.getElementById('weapon');
    weaponSelect.addEventListener('change', onWeaponChange);

    const chargeSelect = document.getElementById('charge');
    chargeSelect.addEventListener('change', onChargeChange);

    const modeSelect = document.getElementById('mode');
    modeSelect.addEventListener('change', onModeChange);

    const absButton = document.getElementById('calculate-abs-btn');
    absButton.addEventListener('click', calculateAbsolute);

    const relButton = document.getElementById('calculate-rel-btn');
    relButton.addEventListener('click', calculateRelative);
}

// FRONT-END ///

/**
 * @returns {Array<TableTabRow>}
 */
function getRows() {
    if (!window.selectedTab) {
        return [];
    }

    return isModeHigh()
        ? window.selectedTab.highRows
        : window.selectedTab.lowRows;
}

/**
 * @param {boolean} isHigh 
 */
function setMode(isHigh) {
    console.log('selecting mode', isHigh);

    window.mode = isHigh;
}

/**
 * @returns {boolean} 
 */
function isModeHigh() {
    return window.mode;
}

/**
 * @param {number|null} index 
 */
function selectTab(index) {
    console.log('selecting tab', index);

    if (index === null || !window.selectedTable) {
        window.selectedTab = null;
        return;
    }

    window.selectedTab = window.selectedTable.tabs[index] || null;
}

/**
 * @param {string|null} vehicleClassName 
 */
function selectTable(vehicleClassName) {
    console.log('selecting table', vehicleClassName);

    if (vehicleClassName === null) {
        window.selectedTab = null;
        return;
    }

    for (const table of window.tables) {
        if (table.vehicleClassName === vehicleClassName) {
            window.selectedTable = table;
            return;
        }
    }

    window.selectedTable = null;
}

/**
 * @param {Array} values 
 */
function init(values) {
    window.tables = values.map(tableValues => new Table(tableValues));
    window.selectedTable = null;
    window.selectedTab = null;
    window.mode = true; // default

    // front-end related
    fillWeapons();
    addEventListeners();
}

/** @type {Array<Table>} */
var tables = [];

/** @type {Table|null} */
var selectedTable;

/** @type {TableTab|null} */
var selectedTab;

/** @type {boolean} */
var mode;

document.addEventListener('DOMContentLoaded', () => {
    fetch('./tables.json')
        .then((response) => response.json())
        .then(init);
});