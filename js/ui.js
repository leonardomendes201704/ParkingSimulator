window.ParkingSim = window.ParkingSim || {};

(function initializeUi(NS) {
  class UIController {
    constructor(controller) {
      this.controller = controller;
      this.keyState = {
        forward: false,
        backward: false,
        left: false,
        right: false,
        brake: false
      };
      this.layoutDebounce = null;
      this.elements = this.queryElements();
      this.populateVehiclePresets();
      this.bindEvents();
    }

    queryElements() {
      return {
        startButton: document.getElementById("startButton"),
        departButton: document.getElementById("departButton"),
        pauseButton: document.getElementById("pauseButton"),
        resetButton: document.getElementById("resetButton"),
        resetCarButton: document.getElementById("resetCarButton"),
        modeSelect: document.getElementById("modeSelect"),
        vehicleSelect: document.getElementById("vehicleSelect"),
        trailToggle: document.getElementById("trailToggle"),
        envelopeToggle: document.getElementById("envelopeToggle"),
        debugToggle: document.getElementById("debugToggle"),
        simSpeedRange: document.getElementById("simSpeedRange"),
        simSpeedValue: document.getElementById("simSpeedValue"),
        scaleRange: document.getElementById("scaleRange"),
        scaleValue: document.getElementById("scaleValue"),
        laneWidthInput: document.getElementById("laneWidthInput"),
        maneuverWidthInput: document.getElementById("maneuverWidthInput"),
        spotWidthInput: document.getElementById("spotWidthInput"),
        spotDepthInput: document.getElementById("spotDepthInput"),
        measureDisplay: document.getElementById("measureDisplay"),
        telemetryDisplay: document.getElementById("telemetryDisplay"),
        statusPill: document.getElementById("statusPill"),
        queueDisplay: document.getElementById("queueDisplay")
      };
    }

    populateVehiclePresets() {
      const presets = NS.Config.vehiclePresets;
      Object.keys(presets).forEach((key) => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = presets[key].label;
        this.elements.vehicleSelect.appendChild(option);
      });
    }

    bindEvents() {
      this.elements.startButton.addEventListener("click", () => this.controller.start());
      this.elements.departButton.addEventListener("click", () => this.controller.startExitSequence());
      this.elements.pauseButton.addEventListener("click", () => this.controller.pause());
      this.elements.resetButton.addEventListener("click", () => this.controller.resetSimulation());
      this.elements.resetCarButton.addEventListener("click", () => this.controller.resetActiveCar());
      this.elements.modeSelect.addEventListener("change", (event) => this.controller.setMode(event.target.value));
      this.elements.vehicleSelect.addEventListener("change", (event) => this.controller.setVehiclePreset(event.target.value));
      this.elements.trailToggle.addEventListener("change", (event) => this.controller.setVisualOption("showTrails", event.target.checked));
      this.elements.envelopeToggle.addEventListener("change", (event) => this.controller.setVisualOption("showEnvelope", event.target.checked));
      this.elements.debugToggle.addEventListener("change", (event) => this.controller.setVisualOption("showDebug", event.target.checked));
      this.elements.simSpeedRange.addEventListener("input", (event) => this.controller.setSimulationSpeed(parseFloat(event.target.value)));
      this.elements.scaleRange.addEventListener("input", (event) => this.controller.setRenderScale(parseFloat(event.target.value)));

      [
        this.elements.laneWidthInput,
        this.elements.maneuverWidthInput,
        this.elements.spotWidthInput,
        this.elements.spotDepthInput
      ].forEach((element) => {
        element.addEventListener("input", () => this.scheduleLayoutUpdate());
      });

      window.addEventListener("keydown", (event) => this.updateKeyState(event, true));
      window.addEventListener("keyup", (event) => this.updateKeyState(event, false));
    }

    updateKeyState(event, isPressed) {
      const tagName = (document.activeElement && document.activeElement.tagName) || "";
      if (["INPUT", "SELECT", "TEXTAREA"].includes(tagName)) return;

      const key = event.key.toLowerCase();
      if (key === "arrowup" || key === "w") {
        this.keyState.forward = isPressed;
        event.preventDefault();
      } else if (key === "arrowdown" || key === "s") {
        this.keyState.backward = isPressed;
        event.preventDefault();
      } else if (key === "arrowleft" || key === "a") {
        this.keyState.left = isPressed;
        event.preventDefault();
      } else if (key === "arrowright" || key === "d") {
        this.keyState.right = isPressed;
        event.preventDefault();
      } else if (key === " " || key === "spacebar") {
        this.keyState.brake = isPressed;
        event.preventDefault();
      }
    }

    scheduleLayoutUpdate() {
      window.clearTimeout(this.layoutDebounce);
      this.layoutDebounce = window.setTimeout(() => {
        this.controller.updateLayoutSettings({
          laneWidth: parseFloat(this.elements.laneWidthInput.value),
          maneuverWidth: parseFloat(this.elements.maneuverWidthInput.value),
          spotWidth: parseFloat(this.elements.spotWidthInput.value),
          spotDepth: parseFloat(this.elements.spotDepthInput.value)
        });
      }, 180);
    }

    applyState(state) {
      this.elements.modeSelect.value = state.mode;
      this.elements.vehicleSelect.value = state.vehiclePresetId;
      this.elements.trailToggle.checked = state.visuals.showTrails;
      this.elements.envelopeToggle.checked = state.visuals.showEnvelope;
      this.elements.debugToggle.checked = state.visuals.showDebug;
      this.elements.simSpeedRange.value = state.settings.simSpeed;
      this.elements.scaleRange.value = state.settings.renderScale;
      this.elements.laneWidthInput.value = state.settings.laneWidth;
      this.elements.maneuverWidthInput.value = state.settings.maneuverWidth;
      this.elements.spotWidthInput.value = state.settings.spotWidth;
      this.elements.spotDepthInput.value = state.settings.spotDepth;
      this.elements.simSpeedValue.textContent = `${state.settings.simSpeed.toFixed(1)}x`;
      this.elements.scaleValue.textContent = `${Math.round(state.settings.renderScale)} px/m`;
      this.updateStatus(state.running);
    }

    updateStatus(isRunning) {
      this.elements.statusPill.textContent = isRunning ? "Rodando" : "Pausado";
      this.elements.statusPill.className = `status-pill ${isRunning ? "running" : "paused"}`;
    }

    updateDisplays(metrics, telemetry, queueItems) {
      this.elements.measureDisplay.innerHTML = [
        `<div><strong>Via:</strong> ${metrics.laneWidth.toFixed(1)} m</div>`,
        `<div><strong>Manobra:</strong> ${metrics.maneuverWidth.toFixed(1)} m</div>`,
        `<div><strong>Vaga:</strong> ${metrics.spotWidth.toFixed(1)} m x ${metrics.spotDepth.toFixed(1)} m</div>`,
        `<div><strong>Carro:</strong> ${metrics.carLength.toFixed(2)} m x ${metrics.carWidth.toFixed(2)} m</div>`,
        `<div><strong>Entre-eixos:</strong> ${metrics.wheelBase.toFixed(2)} m</div>`,
        `<div><strong>Raio mínimo:</strong> ${metrics.minTurningRadius.toFixed(2)} m</div>`
      ].join("");

      this.elements.telemetryDisplay.innerHTML = [
        `<div><strong>Carro:</strong> ${telemetry.label}</div>`,
        `<div><strong>Estado:</strong> ${telemetry.state}</div>`,
        `<div><strong>Velocidade:</strong> ${telemetry.speed.toFixed(2)} m/s</div>`,
        `<div><strong>Esterço:</strong> ${telemetry.steeringDeg.toFixed(1)}°</div>`,
        `<div><strong>Heading:</strong> ${telemetry.headingDeg.toFixed(1)}°</div>`,
        `<div><strong>Status:</strong> ${telemetry.blocked || "Livre"}</div>`
      ].join("");

      this.elements.queueDisplay.innerHTML = queueItems
        .map((item) => `<div class="queue-item"><strong>${item.label}</strong> ${item.text}</div>`)
        .join("");
    }
  }

  NS.UIController = UIController;
})(window.ParkingSim);
