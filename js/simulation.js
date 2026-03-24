window.ParkingSim = window.ParkingSim || {};

(function initializeSimulation(NS) {
  const Geometry = NS.GeometryUtils;

  class SimulationController {
    constructor(options) {
      this.settings = Object.assign({}, NS.Config.defaultSettings);
      this.vehiclePresetId = NS.Config.defaultVehiclePreset;
      this.vehicle = NS.Config.getVehiclePreset(this.vehiclePresetId);
      this.mode = "auto";
      this.autoPhase = "arrival";
      this.running = false;
      this.visuals = {
        showTrails: true,
        showEnvelope: false,
        showDebug: false
      };
      this.scene = new NS.SceneRenderer({ mount: options.mount });
      this.ui = new NS.UIController(this);
      this.cars = [];
      this.manualCar = null;
      this.layout = null;
      this.lastTimestamp = performance.now();
      this.rebuildWorld();
      this.scene.app.ticker.add(() => this.tick());
    }

    rebuildWorld() {
      this.vehicle = NS.Config.getVehiclePreset(this.vehiclePresetId);
      this.layout = new NS.GarageLayout(this.settings, this.vehicle);
      this.scene.setLayout(this.layout, this.settings.renderScale);
      this.buildCars();
      this.ui.applyState(this.getUiState());
      this.refreshHud();
      this.scene.render(this.cars, this.visuals);
    }

    buildCars() {
      const palette = NS.Config.colors.carPalette;
      this.cars = [];
      this.manualCar = null;

      if (this.mode === "auto") {
        for (let index = 0; index < this.layout.spots.length; index += 1) {
          const spawnPose = this.layout.getSpawnPose(index);
          const car = new NS.Car({
            id: `car-${index + 1}`,
            label: `Carro ${index + 1}`,
            color: palette[index % palette.length],
            vehicle: this.vehicle,
            layout: this.layout,
            mode: "AUTO",
            targetSpotIndex: index,
            spawnPose,
            autoPlan: this.layout.buildAutoPlan(index, spawnPose)
          });
          this.cars.push(car);
        }
      } else {
        this.manualCar = new NS.Car({
          id: "manual-car",
          label: "Carro manual",
          color: palette[0],
          vehicle: this.vehicle,
          layout: this.layout,
          mode: "MANUAL",
          spawnPose: this.layout.getSpawnPose(0)
        });
        this.cars.push(this.manualCar);
      }
    }

    getUiState() {
      return {
        mode: this.mode,
        running: this.running,
        autoPhase: this.autoPhase,
        visuals: this.visuals,
        settings: this.settings,
        vehiclePresetId: this.vehiclePresetId
      };
    }

    start() {
      this.running = true;
      if (this.mode === "auto" && this.autoPhase === "arrival") {
        const first = this.cars[0];
        if (first && first.isWaiting()) first.startAuto();
      }
      this.ui.updateStatus(this.running);
    }

    startExitSequence() {
      if (this.mode !== "auto") {
        return;
      }

      const readyToLeave = this.cars.filter((car) => car.isParked());
      if (readyToLeave.length === 0) {
        return;
      }

      this.autoPhase = "departure";
      this.running = true;
      this.releaseCarsIfNeeded();
      this.ui.updateStatus(this.running);
    }

    pause() {
      this.running = false;
      this.ui.updateStatus(this.running);
    }

    resetSimulation() {
      this.running = false;
      this.autoPhase = "arrival";
      this.rebuildWorld();
    }

    resetActiveCar() {
      if (this.mode === "manual" && this.manualCar) {
        this.manualCar.reset(this.layout.getSpawnPose(0));
      } else if (this.mode === "auto") {
        this.running = false;
        this.rebuildWorld();
      }
      this.refreshHud();
      this.scene.render(this.cars, this.visuals);
    }

    setMode(mode) {
      this.mode = mode;
      this.running = false;
      this.autoPhase = "arrival";
      this.rebuildWorld();
    }

    setVehiclePreset(presetId) {
      this.vehiclePresetId = presetId;
      this.running = false;
      this.autoPhase = "arrival";
      this.rebuildWorld();
    }

    setVisualOption(optionName, value) {
      this.visuals[optionName] = value;
      this.scene.render(this.cars, this.visuals);
      this.ui.applyState(this.getUiState());
    }

    setSimulationSpeed(value) {
      this.settings.simSpeed = Geometry.clamp(value, 0.4, 2.5);
      this.ui.applyState(this.getUiState());
    }

    setRenderScale(value) {
      this.settings.renderScale = Geometry.clamp(value, 28, 70);
      this.scene.setLayout(this.layout, this.settings.renderScale);
      this.scene.render(this.cars, this.visuals);
      this.ui.applyState(this.getUiState());
    }

    updateLayoutSettings(patch) {
      const values = [patch.laneWidth, patch.maneuverWidth, patch.spotWidth, patch.spotDepth];
      if (values.some((value) => !Number.isFinite(value))) {
        return;
      }

      this.settings.laneWidth = Geometry.clamp(patch.laneWidth, 2.8, 5.5);
      this.settings.maneuverWidth = Geometry.clamp(patch.maneuverWidth, 4.5, 9.0);
      this.settings.spotWidth = Geometry.clamp(patch.spotWidth, 2.3, 4.5);
      this.settings.spotDepth = Geometry.clamp(patch.spotDepth, 4.5, 7.5);
      this.running = false;
      this.autoPhase = "arrival";
      this.rebuildWorld();
    }

    releaseCarsIfNeeded() {
      if (this.mode !== "auto") return;
      if (this.autoPhase === "departure") {
        const exitOrder = this.cars.map((_, index) => index).reverse();
        for (let orderIndex = 0; orderIndex < exitOrder.length; orderIndex += 1) {
          const carIndex = exitOrder[orderIndex];
          const car = this.cars[carIndex];
          if (car.isExited()) {
            continue;
          }
          if (!car.isParked()) {
            break;
          }
          if (orderIndex === 0 || this.cars[exitOrder[orderIndex - 1]].isExited()) {
            car.startExit(this.layout.buildExitPlan(car.targetSpotIndex, car.getRearAxlePosition()));
          }
          break;
        }
        return;
      }

      for (let index = 0; index < this.cars.length; index += 1) {
        const car = this.cars[index];
        if (!car.isWaiting()) continue;
        if (index === 0) {
          if (this.running) car.startAuto();
          break;
        }
        if (this.cars[index - 1].isParked()) {
          car.startAuto();
        }
        break;
      }
    }

    tick() {
      const now = performance.now();
      const rawDt = Math.min(0.05, (now - this.lastTimestamp) / 1000);
      this.lastTimestamp = now;
      const dt = rawDt * this.settings.simSpeed;

      if (this.running) {
        this.releaseCarsIfNeeded();
        this.cars.forEach((car) => {
          car.update(dt, {
            cars: this.cars,
            keys: this.ui.keyState,
            baseLookAhead: this.settings.lookAheadBase
          });
          car.trimHistory(this.settings.trailMaxPoints, this.settings.envelopeMaxPoints);
        });

        if (this.autoPhase === "departure" && this.cars.every((car) => car.isExited())) {
          this.running = false;
          this.ui.updateStatus(this.running);
        }
      }

      this.scene.render(this.cars, this.visuals);
      this.refreshHud();
    }

    getFocusCar() {
      if (this.mode === "manual" && this.manualCar) return this.manualCar;
      return this.cars.find((car) => !car.isParked() && !car.isExited()) || this.cars[this.cars.length - 1];
    }

    refreshHud() {
      const focusCar = this.getFocusCar();
      const metrics = this.layout.getMetrics(this.vehicle);
      const telemetry = focusCar
        ? Object.assign(focusCar.getTelemetry(), {
            headingDeg: Geometry.toDegrees(focusCar.heading),
            steeringDeg: Geometry.toDegrees(focusCar.steering),
            blocked: focusCar.blocked ? focusCar.blockedReason : ""
          })
        : {
            label: "-",
            state: "-",
            speed: 0,
            headingDeg: 0,
            steeringDeg: 0,
            blocked: ""
          };
      const queueItems = this.cars.map((car) => {
        let text = `em ${this.mode === "manual" ? "controle manual" : car.state}`;
        if (car.targetSpotIndex != null) text += ` | vaga ${car.targetSpotIndex + 1}`;
        if (car.blocked) text += ` | ${car.blockedReason}`;
        if (car.isExited()) text += " | saiu";
        return { label: car.label, text };
      });

      this.ui.updateDisplays(metrics, telemetry, queueItems);
    }
  }

  NS.SimulationController = SimulationController;
})(window.ParkingSim);
