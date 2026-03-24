window.addEventListener("DOMContentLoaded", () => {
  const simulator = new window.ParkingSim.SimulationController({
    mount: document.getElementById("canvasMount")
  });

  window.parkingSimulator = simulator;
});
