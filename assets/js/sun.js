/* Sun over Tucson. NOAA solar position (the spreadsheet algorithm), no dependencies.
   Tucson keeps UTC-7 all year (no DST), so TZ is fixed. QA: ?sun=HH:MM pins Sun.now(). */
(function () {
  'use strict';
  var RAD = Math.PI / 180, DEG = 180 / Math.PI, DAY = 86400000;
  var LAT = 32.2226, LON = -110.9747, TZ = -7;
  var WIND = ['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west'];

  function mod(a, n) { return ((a % n) + n) % n; }

  // Orbital terms for a Date: declination (deg) and equation of time (minutes)
  function orbit(date) {
    var jd = date.getTime() / DAY + 2440587.5, T = (jd - 2451545) / 36525;
    var L0 = mod(280.46646 + T * (36000.76983 + T * 0.0003032), 360);
    var M = 357.52911 + T * (35999.05029 - 0.0001537 * T);
    var e = 0.016708634 - T * (0.000042037 + 0.0000001267 * T);
    var Mr = M * RAD;
    var C = Math.sin(Mr) * (1.914602 - T * (0.004817 + 0.000014 * T)) + Math.sin(2 * Mr) * (0.019993 - 0.000101 * T) + Math.sin(3 * Mr) * 0.000289;
    var trueLong = L0 + C;
    var appLong = trueLong - 0.00569 - 0.00478 * Math.sin((125.04 - 1934.136 * T) * RAD);
    var obl0 = 23 + (26 + (21.448 - T * (46.815 + T * (0.00059 - T * 0.001813))) / 60) / 60;
    var obl = obl0 + 0.00256 * Math.cos((125.04 - 1934.136 * T) * RAD);
    var decl = Math.asin(Math.sin(obl * RAD) * Math.sin(appLong * RAD)) * DEG;
    var y = Math.pow(Math.tan(obl * RAD / 2), 2), L0r = L0 * RAD;
    var eq = 4 * DEG * (y * Math.sin(2 * L0r) - 2 * e * Math.sin(Mr) + 4 * e * y * Math.sin(Mr) * Math.cos(2 * L0r) -
      0.5 * y * y * Math.sin(4 * L0r) - 1.25 * e * e * Math.sin(2 * Mr));
    return { decl: decl, eq: eq };
  }

  function refraction(el) { // arc-seconds -> degrees, NOAA piecewise
    var r, t = Math.tan(el * RAD);
    if (el > 85) r = 0;
    else if (el > 5) r = 58.1 / t - 0.07 / Math.pow(t, 3) + 0.000086 / Math.pow(t, 5);
    else if (el > -0.575) r = 1735 + el * (-518.2 + el * (103.4 + el * (-12.79 + el * 0.711)));
    else r = -20.772 / t;
    return r / 3600;
  }

  function position(date) {
    var o = orbit(date);
    var utcMin = date.getUTCHours() * 60 + date.getUTCMinutes() + date.getUTCSeconds() / 60 + date.getUTCMilliseconds() / 60000;
    var tst = mod(utcMin + o.eq + 4 * LON, 1440);          // true solar time, minutes
    var ha = tst / 4 - 180; if (ha < -180) ha += 360;
    var la = LAT * RAD, de = o.decl * RAD;
    var cz = Math.sin(la) * Math.sin(de) + Math.cos(la) * Math.cos(de) * Math.cos(ha * RAD);
    cz = Math.max(-1, Math.min(1, cz));
    var zen = Math.acos(cz) * DEG, el0 = 90 - zen;
    var den = Math.cos(la) * Math.sin(zen * RAD), az;
    if (Math.abs(den) > 0.001) {
      var a = Math.max(-1, Math.min(1, (Math.sin(la) * cz - Math.sin(de)) / den));
      a = Math.acos(a) * DEG;
      az = ha > 0 ? mod(a + 180, 360) : mod(540 - a, 360);
    } else az = lat0() > 0 ? 180 : 0;
    return { azimuth: az, elevation: el0 + refraction(el0) };
  }
  function lat0() { return LAT; }

  function localMidnight(date) { // UTC ms of 00:00 Tucson time on date's Tucson calendar day
    var s = new Date(date.getTime() + TZ * 3600000);
    return Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()) - TZ * 3600000;
  }

  function times(date) {
    var mid = localMidnight(date), noonGuess = new Date(mid + 12 * 3600000);
    var o = orbit(noonGuess);
    var noonMin = 720 - 4 * LON - o.eq;                     // minutes since UTC midnight of that UTC day
    var base = Date.UTC(noonGuess.getUTCFullYear(), noonGuess.getUTCMonth(), noonGuess.getUTCDate());
    var noon = new Date(base + noonMin * 60000);
    o = orbit(noon);                                       // second pass at the real noon
    noonMin = 720 - 4 * LON - o.eq; noon = new Date(base + noonMin * 60000);
    var la = LAT * RAD, de = o.decl * RAD;
    var c = (Math.cos(90.833 * RAD) / (Math.cos(la) * Math.cos(de))) - Math.tan(la) * Math.tan(de);
    c = Math.max(-1, Math.min(1, c));
    var haMin = 4 * Math.acos(c) * DEG;
    return { sunrise: new Date(noon.getTime() - haMin * 60000), noon: noon, sunset: new Date(noon.getTime() + haMin * 60000) };
  }

  function clock(date) {
    var s = new Date(date.getTime() + TZ * 3600000), h = s.getUTCHours(), m = s.getUTCMinutes();
    return ((h % 12) || 12) + ':' + (m < 10 ? '0' : '') + m + ' ' + (h < 12 ? 'am' : 'pm');
  }

  function compass(az) { return WIND[Math.round(mod(az, 360) / 45) % 8]; }

  function now() {
    var m = /[?&]sun=(\d{1,2}):(\d{2})/.exec(location.search), d = new Date();
    if (!m) return d;
    return new Date(localMidnight(d) + (+m[1] * 60 + +m[2]) * 60000);
  }

  // Known values: solar noon elevation 81.2 deg (June solstice) and 34.3 deg (December), within 0.5 deg
  function selfTest() {
    function chk(ok, msg) { if (!ok) throw new Error('Sun self-test: ' + msg); }
    var jun = times(new Date(Date.UTC(2026, 5, 21, 19))), dec = times(new Date(Date.UTC(2026, 11, 21, 19)));
    var pj = position(jun.noon), pd = position(dec.noon);
    chk(Math.abs(pj.elevation - 81.2) < 0.5, 'June noon elevation ' + pj.elevation.toFixed(2));
    chk(Math.abs(pd.elevation - 34.3) < 0.5, 'December noon elevation ' + pd.elevation.toFixed(2));
    chk(Math.abs(pj.azimuth - 180) < 3 && Math.abs(pd.azimuth - 180) < 3, 'noon azimuth is south');
    var tj = jun.sunset - jun.sunrise, td = dec.sunset - dec.sunrise;
    chk(tj > 13.2 * 3600000 && tj < 14.4 * 3600000, 'June day length');
    chk(td > 10.0 * 3600000 && td < 10.7 * 3600000, 'December day length');
    chk(position(new Date(jun.noon.getTime() + 12 * 3600000)).elevation < -30, 'midnight sun is below the horizon');
    chk(Math.abs(position(jun.sunrise).elevation) < 1.2, 'sun at the horizon at sunrise');
    chk(clock(new Date(Date.UTC(2026, 5, 21, 23, 12))) === '4:12 pm', 'clock format');
    chk(compass(225) === 'south-west' && compass(359) === 'north', 'compass');
    return true;
  }

  window.Sun = { LAT: LAT, LON: LON, TZ: TZ, position: position, times: times, clock: clock, compass: compass, now: now, _selfTest: selfTest };
})();
