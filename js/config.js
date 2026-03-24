window.ParkingSim = window.ParkingSim || {};

(function initializeConfig(NS) {
  function deriveVehicle(rawProfile) {
    const profile = Object.assign({}, rawProfile);
    const maxSteeringRad = (profile.maxSteeringDeg * Math.PI) / 180;
    const totalOverhang = Math.max(profile.length - profile.wheelBase, 0.6);
    const rearOverhang = profile.rearOverhang != null ? profile.rearOverhang : totalOverhang / 2;
    const frontOverhang = Math.max(profile.length - profile.wheelBase - rearOverhang, 0.3);

    profile.maxSteeringRad = maxSteeringRad;
    profile.rearOverhang = rearOverhang;
    profile.frontOverhang = frontOverhang;
    profile.bodyCenterOffset = profile.length / 2 - rearOverhang;
    profile.minTurningRadius = profile.wheelBase / Math.tan(maxSteeringRad);
    profile.maxSpeed = profile.maxSpeed != null ? profile.maxSpeed : 5.4;
    profile.maxAccel = profile.maxAccel != null ? profile.maxAccel : 2.4;
    profile.maxBrake = profile.maxBrake != null ? profile.maxBrake : 4.4;
    profile.steeringRate = profile.steeringRate != null ? profile.steeringRate : 1.8;
    profile.drag = profile.drag != null ? profile.drag : 0.85;
    return profile;
  }

  const vehiclePresets = {
    hatch: deriveVehicle({
      id: "hatch",
      label: "Hatch",
      length: 4.15,
      width: 1.76,
      wheelBase: 2.55,
      maxSteeringDeg: 36,
      maxAccel: 2.8,
      maxBrake: 4.8,
      maxSpeed: 5.7
    }),
    sedan: deriveVehicle({
      id: "sedan",
      label: "Sedan",
      length: 4.7,
      width: 1.9,
      wheelBase: 2.7,
      maxSteeringDeg: 33,
      maxAccel: 2.5,
      maxBrake: 4.7,
      maxSpeed: 5.5
    }),
    suv: deriveVehicle({
      id: "suv",
      label: "SUV",
      length: 4.85,
      width: 1.95,
      wheelBase: 2.78,
      maxSteeringDeg: 31,
      maxAccel: 2.35,
      maxBrake: 4.5,
      maxSpeed: 5.2
    })
  };

  NS.Config = {
    getVehiclePreset(presetId) {
      return deriveVehicle(vehiclePresets[presetId] || vehiclePresets.sedan);
    },
    vehiclePresets,
    defaultVehiclePreset: "sedan",
    defaultSettings: {
      laneWidth: 3.2,
      maneuverWidth: 6.0,
      transitionLength: 3.0,
      spotWidth: 3.4,
      spotDepth: 5.5,
      spotCount: 3,
      approachLength: 24,
      aisleExitBuffer: 3.2,
      leftMargin: 2.8,
      topMargin: 2.2,
      rightMargin: 3.0,
      bottomMargin: 2.8,
      queueSpacing: 6.4,
      renderScale: 44,
      simSpeed: 1.0,
      trailMaxPoints: 320,
      envelopeMaxPoints: 240,
      lookAheadBase: 2.1
    },
    colors: {
      background: 0x0e1520,
      asphalt: 0x19212d,
      curb: 0x6d7c93,
      freeSpot: 0x142030,
      occupiedSpot: 0x173f39,
      spotBorder: 0x5b6b84,
      laneLine: 0xdbe7f5,
      laneGuide: 0x4fc6ff,
      entryArrow: 0x88f0c7,
      debug: 0xffbf69,
      carPalette: [0x5fc8ff, 0xff8e72, 0xa4ef7e]
    },
    fonts: {
      ui: "Space Grotesk",
      mono: "IBM Plex Mono"
    }
  };
})(window.ParkingSim);
