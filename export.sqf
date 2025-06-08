0 spawn {

_artilleries = ("configName _x isKindOf 'LandVehicle' && getNumber (_x >> 'scope') == 2" configClasses (configFile >> "CfgVehicles")) select {
	private _showRangetable = if (isNumber (_x >> "ace_artillerytables_showRangetable")) then {
		getNumber (_x >> "ace_artillerytables_showRangetable")
	} else {
		getNumber (_x >> "artilleryScanner")
	};
	
	_showRangetable == 1
};

_toProccess = [];

{
    systemChat format ["creating: %1", configName _x];
    _x = (configName _x) createVehicle [0,0,0];

    private _vehicleCfg = configOf _x;

    private _showRangetable = if (isNumber (_vehicleCfg >> "ace_artillerytables_showRangetable")) then {
        getNumber (_vehicleCfg >> "ace_artillerytables_showRangetable")
    } else {
        getNumber (_vehicleCfg >> "artilleryScanner")
    };
    if (_showRangetable == 1) then {
        private _vehicle = _x;
        private _turret = [];
        private _turretCfg = configNull; 
        {
            private _xTurretCfg = [_vehicleCfg, _x] call CBA_fnc_getTurret;
            if ((getNumber (_xTurretCfg >> "primaryGunner")) == 1) exitWith {
                _turret = _x;
                _turretCfg = _xTurretCfg;
            };
        } forEach allTurrets _vehicle;
        ;
        if (isNull _turretCfg) exitWith {};

        private _weaponsTurret = _vehicle weaponsTurret _turret;
        if ((count _weaponsTurret) < 1) exitWith {};
        private _weapon = _weaponsTurret select 0;

        private _turretAnimBody = getText (_turretCfg >> "animationSourceBody");
        private _turretAnimGun = getText (_turretCfg >> "animationSourceGun");

        private _currentElevRad = _vehicle animationSourcePhase _turretAnimGun;
        if (isNil "_currentElevRad") then { _currentElevRad = _vehicle animationPhase _turretAnimGun; };
        private _currentTraverseRad = _vehicle animationSourcePhase _turretAnimBody;
        if (isNil "_currentTraverseRad") then { _currentTraverseRad = _vehicle animationPhase _turretAnimBody; };

        private _weaponDir = _vehicle weaponDirection _weapon;
        private _turretRot = [vectorDir _vehicle, vectorUp _vehicle, deg _currentTraverseRad] call CBA_fnc_vectRotate3D;
        private _neutralX = (acos ((_turretRot vectorCos _weaponDir) min 1)) - (deg _currentElevRad); 
        _neutralX = (round (_neutralX * 10)) / 10; 
        private _minElev = _neutralX + getNumber (_turretCfg >> "minElev");
        private _maxElev = _neutralX + getNumber (_turretCfg >> "maxElev");

        private _applyCorrections = if (isNumber (_vehicleCfg >> "ace_artillerytables_applyCorrections")) then {
            getNumber (_vehicleCfg >> "ace_artillerytables_applyCorrections")
        } else {
            getNumber (_vehicleCfg >> "artilleryScanner")
        };
        private _advCorrection = ace_artillerytables_advancedCorrections && {_applyCorrections == 1};
        if ((missionNamespace getVariable ["ace_mk6Mortar_airResistanceEnabled", false]) && {_vehicle isKindOf "Mortar_01_base_F"}) then {
            _advCorrection = true;
        };
        
        _toProccess pushBack [configName _vehicleCfg, getText (_vehicleCfg >> "displayName"),_weapon, _minElev, _maxElev, _advCorrection];
    };

    deleteVehicle _x;
} forEach _artilleries;

results = [];

{
    sleep 0.1;

    _x params ["_configName", "_displayName", "_weaponName", "_elevMin", "_elevMax", "_advCorrection"];

    systemChat format ["processing: %1", _configName];

    private _mags = [_weaponName] call CBA_fnc_compatibleMagazines;
    if (_mags isEqualTo []) exitWith {};
    private _magCfg = configFile >> "CfgMagazines";
    private _magParamsArray = [];
    _mags = _mags apply {
        private _initSpeed = getNumber (_magCfg >> _x >> "initSpeed");
        _magParamsArray pushBackUnique _initSpeed;
        private _airFriction = 0;
        private _magAirFriction = getNumber (_magCfg >> _x >> "ace_artillerytables_airFriction");
        if (_magAirFriction <= 0) then {
            if (_advCorrection) then {
                _airFriction = [-0.00006, _magAirFriction] select (isNumber (_magCfg >> _x >> "ace_artillerytables_airFriction"));
            };
        } else {

            private _ammo = getText (_magCfg >> _x >> "ammo");
            _airFriction = getNumber (configFile >> "CfgAmmo" >> _ammo >> "airFriction");
        };
        _magParamsArray pushBackUnique _airFriction;
        [getText (_magCfg >> _x >> "displayNameShort"), getText (_magCfg >> _x >> "displayName"), _initSpeed, _airFriction]
    };
    _mags = _mags arrayIntersect _mags;

    if ((count _magParamsArray) == 2) then { 
        _mags = [["", "All Magazines", (_mags select 0) select 2, (_mags select 0) select 3]]; 
    };


    private _fireModes = getArray (configFile >> "CfgWeapons" >> _weaponName >> "modes");
    _fireModes = (_fireModes apply {configFile >> "CfgWeapons" >> _weaponName >> _x}) select {1 == getNumber (_x >> "showToPlayer")};
    _fireModes = _fireModes apply {[getNumber (_x >> "artilleryCharge"), configName _x]};
    _fireModes sort true;
    private _allSameCharge = ((count _fireModes) == 1) && {((_fireModes select 0) select 0) == 1};

    ace_artillerytables_magModeData = [];
    {
        _x params ["_xDisplayNameShort", "_xDisplayName", "_xInitSpeed", "_xAirFriction"];
        if (_allSameCharge) then {
            ace_artillerytables_magModeData pushBack [_xDisplayNameShort, _xDisplayName, _xInitSpeed, _xAirFriction];
        } else {
            {
                _x params ["_xModeCharge"];
                ace_artillerytables_magModeData pushBack [format ["[Charge %1] %2", _forEachIndex, _xDisplayNameShort], _xDisplayName, _xInitSpeed * _xModeCharge, _xAirFriction];
            } forEach _fireModes;
        };
    } forEach _mags;


    if (isNil "ace_artillerytables_lastElevationMode") then {ace_artillerytables_lastElevationMode = true;};
    if (isNil "ace_artillerytables_lastTablePage") then {ace_artillerytables_lastTablePage = 0;};
    if ((ace_artillerytables_lastTablePage >= (count ace_artillerytables_magModeData)) || {ace_artillerytables_lastTablePage < 0}) then { ace_artillerytables_lastTablePage = 0; };

    // ...

    _tabs = [];

    {
        _x params ["_tab", "_magName", "_muzzleVelocity", "_airFriction"];

        _linesHigh = [];
        _linesLow = [];

        ace_artillerytables_tableSizeReceived = 0;
        ace_artillerytables_tableData = createHashMap;
        ace_artillerytables_tableSizeActual = 99999;

        systemChat format ["calling dll: %1 (high)", _configName];
        // high = true; low = false
        (
            "ace" callExtension ["artillery:calculate_table", [_muzzleVelocity, _airFriction, _elevMin, _elevMax, true]]
        ) params ["_data", "_code"];

        ace_artillerytables_tableSizeActual = (parseSimpleArray _data) select 1;

        _timeoutTime = time + 0.1;
        _timeout = false;

        waitUntil {
            sleep 0.01;
            systemChat format ["waiting response dll: %1 (high) - %2 / %3", _configName, ace_artillerytables_tableSizeReceived, ace_artillerytables_tableSizeActual];
            _timeout = time > _timeoutTime;
            _timeout || {ace_artillerytables_tableSizeActual == ace_artillerytables_tableSizeReceived}
        };

        if (_timeout) then {ace_artillerytables_tableSizeActual = 0};

        for "_i" from 0 to ace_artillerytables_tableSizeActual do {
            private _row = ace_artillerytables_tableData getOrDefault [_i, []];
            if (count _row == 12) then {
                _linesHigh pushBack (_row apply { parseNumber _x });
            };
        };

        ace_artillerytables_tableSizeReceived = 0;
        ace_artillerytables_tableData = createHashMap;
        ace_artillerytables_tableSizeActual = 99999;
        
        systemChat format ["calling dll: %1 (low)", _configName];
        // high = true; low = false
        (
            "ace" callExtension ["artillery:calculate_table", [_muzzleVelocity, _airFriction, _elevMin, _elevMax, false]]
        ) params ["_data", "_code"];

        ace_artillerytables_tableSizeActual = (parseSimpleArray _data) select 1;

        _timeoutTime = time + 0.1;
        _timeout = false;

        waitUntil {
            sleep 0.01;
            systemChat format ["waiting response dll: %1 (low) - %2 / %3", _configName, ace_artillerytables_tableSizeReceived, ace_artillerytables_tableSizeActual];
            _timeout = time > _timeoutTime;
            _timeout || {ace_artillerytables_tableSizeActual == ace_artillerytables_tableSizeReceived}
        };

        if (_timeout) then {ace_artillerytables_tableSizeActual = 0};

        for "_i" from 0 to ace_artillerytables_tableSizeActual do {
            private _row = ace_artillerytables_tableData getOrDefault [_i, []];
            if (count _row == 12) then {
                _linesLow pushBack (_row apply { parseNumber _x });
            };
        };

        if (_linesHigh isEqualTo [] && {_linesLow isEqualTo []}) then {continue};
        _tabs pushBack [
            _tab,
            _magName,
            _linesHigh,
            _linesLow
        ];
    } forEach ace_artillerytables_magModeData;

    if (_tabs isEqualTo []) then {continue};
    results pushBack [
        _configName,
        _displayName,
        _tabs
    ];
} forEach _toProccess;

forceUnicode 1;
copyToClipboard toJSON results;
hint "copied";

};