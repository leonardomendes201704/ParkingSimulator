window.ParkingSim = window.ParkingSim || {};

(function initializeScene(NS) {
  const Geometry = NS.GeometryUtils;
  const colors = NS.Config.colors;

  function tintToHex(value) {
    return `#${value.toString(16).padStart(6, "0")}`;
  }

  class SceneRenderer {
    constructor(options) {
      this.mount = options.mount;
      this.padding = 34;
      this.scale = NS.Config.defaultSettings.renderScale;
      this.layout = null;
      this.carViews = new Map();
      this.createPixiApp();
    }

    createPixiApp() {
      this.app = new PIXI.Application({
        width: 1200,
        height: 760,
        antialias: true,
        backgroundColor: colors.background,
        resolution: Math.max(window.devicePixelRatio || 1, 1)
      });

      this.root = new PIXI.Container();
      this.gridLayer = new PIXI.Graphics();
      this.surfaceLayer = new PIXI.Graphics();
      this.spotLayer = new PIXI.Container();
      this.guideLayer = new PIXI.Graphics();
      this.annotationLayer = new PIXI.Container();
      this.trailLayer = new PIXI.Container();
      this.envelopeLayer = new PIXI.Container();
      this.carLayer = new PIXI.Container();
      this.debugLayer = new PIXI.Graphics();

      this.root.addChild(this.gridLayer);
      this.root.addChild(this.surfaceLayer);
      this.root.addChild(this.spotLayer);
      this.root.addChild(this.guideLayer);
      this.root.addChild(this.annotationLayer);
      this.root.addChild(this.trailLayer);
      this.root.addChild(this.envelopeLayer);
      this.root.addChild(this.carLayer);
      this.root.addChild(this.debugLayer);
      this.app.stage.addChild(this.root);

      this.mount.innerHTML = "";
      this.mount.appendChild(this.app.view);
    }

    setLayout(layout, scale) {
      this.layout = layout;
      this.scale = scale;
      this.resize();
      this.drawBackgroundGrid();
      this.drawLayout(options);
    }

    resize() {
      if (!this.layout) return;
      const width = this.layout.dimensions.worldWidth * this.scale + this.padding * 2;
      const height = this.layout.dimensions.worldHeight * this.scale + this.padding * 2;
      this.app.renderer.resize(width, height);
      this.root.position.set(this.padding, this.padding);
      this.root.scale.set(this.scale);
    }

    drawBackgroundGrid() {
      if (!this.layout) return;
      const width = this.layout.dimensions.worldWidth;
      const height = this.layout.dimensions.worldHeight;
      this.gridLayer.clear();
      this.gridLayer.lineStyle(0.02, 0x273545, 1);

      for (let x = 0; x <= width; x += 1) {
        this.gridLayer.moveTo(x, 0);
        this.gridLayer.lineTo(x, height);
      }
      for (let y = 0; y <= height; y += 1) {
        this.gridLayer.moveTo(0, y);
        this.gridLayer.lineTo(width, y);
      }
    }

    drawLayout(options) {
      if (!this.layout) return;
      const layout = this.layout;
      const visuals = options || {};
      this.surfaceLayer.clear();
      this.spotLayer.removeChildren();
      this.guideLayer.clear();
      this.annotationLayer.removeChildren();

      this.surfaceLayer.beginFill(colors.asphalt, 1);
      this.surfaceLayer.drawRect(layout.aisleRect.x, layout.aisleRect.y, layout.aisleRect.width, layout.aisleRect.height);
      this.surfaceLayer.drawRect(layout.laneRect.x, layout.laneRect.y, layout.laneRect.width, layout.laneRect.height);
      this.surfaceLayer.drawRect(layout.exitRect.x, layout.exitRect.y, layout.exitRect.width, layout.exitRect.height);
      this.surfaceLayer.drawRect(
        layout.lowerManeuverRect.x,
        layout.lowerManeuverRect.y,
        layout.lowerManeuverRect.width,
        layout.lowerManeuverRect.height
      );
      this.surfaceLayer.drawRect(layout.upperApronRect.x, layout.upperApronRect.y, layout.upperApronRect.width, layout.upperApronRect.height);
      this.surfaceLayer.drawRect(layout.topApronRect.x, layout.topApronRect.y, layout.topApronRect.width, layout.topApronRect.height);
      this.surfaceLayer.drawRect(layout.bottomApronRect.x, layout.bottomApronRect.y, layout.bottomApronRect.width, layout.bottomApronRect.height);
      layout.gapRects.forEach((gapRect) => {
        this.surfaceLayer.drawRect(gapRect.x, gapRect.y, gapRect.width, gapRect.height);
      });
      layout.spots.forEach((spot) => {
        this.surfaceLayer.drawRect(spot.x, spot.y, spot.width, spot.height);
      });
      this.surfaceLayer.endFill();

      this.surfaceLayer.lineStyle(0.08, colors.curb, 1);
      this.surfaceLayer.drawRect(layout.aisleRect.x, layout.aisleRect.y, layout.aisleRect.width, layout.aisleRect.height);
      this.surfaceLayer.drawRect(layout.laneRect.x, layout.laneRect.y, layout.laneRect.width, layout.laneRect.height);
      this.surfaceLayer.drawRect(layout.exitRect.x, layout.exitRect.y, layout.exitRect.width, layout.exitRect.height);
      this.surfaceLayer.drawRect(
        layout.lowerManeuverRect.x,
        layout.lowerManeuverRect.y,
        layout.lowerManeuverRect.width,
        layout.lowerManeuverRect.height
      );
      this.surfaceLayer.drawRect(layout.upperApronRect.x, layout.upperApronRect.y, layout.upperApronRect.width, layout.upperApronRect.height);
      this.surfaceLayer.drawRect(layout.topApronRect.x, layout.topApronRect.y, layout.topApronRect.width, layout.topApronRect.height);
      this.surfaceLayer.drawRect(layout.bottomApronRect.x, layout.bottomApronRect.y, layout.bottomApronRect.width, layout.bottomApronRect.height);
      layout.gapRects.forEach((gapRect) => {
        this.surfaceLayer.drawRect(gapRect.x, gapRect.y, gapRect.width, gapRect.height);
      });
      layout.spots.forEach((spot) => {
        this.surfaceLayer.drawRect(spot.x, spot.y, spot.width, spot.height);
      });

      this.drawCenterGuides();
      this.drawEntryArrow();
      this.drawSpots();
      if (visuals.showEnvelope) {
        this.drawArcConstruction();
      }
    }

    drawCenterGuides() {
      const path = this.layout.getTurnGuidePath();
      this.drawDashedPath(this.guideLayer, path, 0.16, colors.laneLine, 0.62, 0.9, 0.48);
      const stagingLineX = this.layout.dimensions.spotX - 0.85;
      this.guideLayer.lineStyle(0.05, colors.laneGuide, 0.44);
      this.guideLayer.moveTo(stagingLineX, this.layout.aisleRect.y + 0.25);
      this.guideLayer.lineTo(stagingLineX, this.layout.aisleRect.y + this.layout.aisleRect.height - 0.25);
    }

    drawEntryArrow() {
      const arrow = this.layout.entryArrow;
      this.guideLayer.lineStyle(0.09, colors.entryArrow, 0.9);
      this.guideLayer.moveTo(arrow.from.x, arrow.from.y);
      this.guideLayer.lineTo(arrow.to.x, arrow.to.y);
      this.guideLayer.moveTo(arrow.to.x, arrow.to.y);
      this.guideLayer.lineTo(arrow.to.x - 0.22, arrow.to.y + 0.34);
      this.guideLayer.moveTo(arrow.to.x, arrow.to.y);
      this.guideLayer.lineTo(arrow.to.x + 0.22, arrow.to.y + 0.34);
    }

    drawArcConstruction() {
      const guides = this.layout.getArcGuides();
      guides.forEach((guide, index) => {
        const accentColor = index === 0 ? colors.laneGuide : colors.entryArrow;
        this.drawDashedCircle(this.guideLayer, guide.center, guide.radius, 0.05, accentColor, 0.42, 0.45, 0.24);

        this.guideLayer.lineStyle(0.05, accentColor, 0.8);
        this.guideLayer.moveTo(guide.center.x, guide.center.y);
        this.guideLayer.lineTo(guide.radiusTo.x, guide.radiusTo.y);
        this.guideLayer.beginFill(accentColor, 0.95);
        this.guideLayer.drawCircle(guide.center.x, guide.center.y, 0.09);
        this.guideLayer.endFill();

        const midPoint = Geometry.midpoint(guide.center, guide.radiusTo);
        const radiusLabel = new PIXI.Text(`R = ${guide.radius.toFixed(2)} m`, {
          fill: tintToHex(accentColor),
          fontFamily: NS.Config.fonts.mono,
          fontSize: 0.3 * this.scale,
          fontWeight: "700"
        });
        radiusLabel.anchor.set(0.5);
        radiusLabel.position.set(
          midPoint.x + (guide.labelOffset ? guide.labelOffset.x : 0),
          midPoint.y + (guide.labelOffset ? guide.labelOffset.y : 0)
        );
        radiusLabel.scale.set(1 / this.scale);
        this.annotationLayer.addChild(radiusLabel);

        const centerLabel = new PIXI.Text(guide.label, {
          fill: "#d9e4f5",
          fontFamily: NS.Config.fonts.ui,
          fontSize: 0.24 * this.scale,
          fontWeight: "600"
        });
        centerLabel.anchor.set(0.5, 1.2);
        centerLabel.position.set(guide.center.x, guide.center.y);
        centerLabel.scale.set(1 / this.scale);
        this.annotationLayer.addChild(centerLabel);
      });
    }

    drawSpots() {
      this.layout.spots.forEach((spot) => {
        const graphics = new PIXI.Graphics();
        graphics.lineStyle(0.05, colors.spotBorder, 1);
        graphics.beginFill(spot.occupiedBy != null ? colors.occupiedSpot : colors.freeSpot, 0.95);
        graphics.drawRect(spot.x, spot.y, spot.width, spot.height);
        graphics.endFill();

        const label = new PIXI.Text(`VAGA ${spot.number}`, {
          fill: "#d9e4f5",
          fontFamily: NS.Config.fonts.ui,
          fontSize: 0.34 * this.scale,
          fontWeight: "700",
          letterSpacing: 1.5,
          align: "center"
        });
        label.anchor.set(0.5);
        label.position.set(spot.x + spot.width * 0.5, spot.y + 0.45);
        label.scale.set(1 / this.scale);

        this.spotLayer.addChild(graphics);
        this.spotLayer.addChild(label);
      });
    }

    drawDashedPath(graphics, points, lineWidth, color, alpha, dashLength, gapLength) {
      graphics.lineStyle(lineWidth, color, alpha);
      for (let index = 1; index < points.length; index += 1) {
        const start = points[index - 1];
        const end = points[index];
        const length = Geometry.distance(start, end);
        const dx = (end.x - start.x) / length;
        const dy = (end.y - start.y) / length;
        let traveled = 0;

        while (traveled < length) {
          const dashStart = traveled;
          const dashEnd = Math.min(length, traveled + dashLength);
          graphics.moveTo(start.x + dx * dashStart, start.y + dy * dashStart);
          graphics.lineTo(start.x + dx * dashEnd, start.y + dy * dashEnd);
          traveled += dashLength + gapLength;
        }
      }
    }

    drawDashedCircle(graphics, center, radius, lineWidth, color, alpha, dashArcLength, gapArcLength) {
      graphics.lineStyle(lineWidth, color, alpha);
      const circumference = Math.PI * 2 * radius;
      let traveled = 0;

      while (traveled < circumference) {
        const startLength = traveled;
        const endLength = Math.min(circumference, traveled + dashArcLength);
        const startAngle = startLength / radius;
        const endAngle = endLength / radius;
        const steps = Math.max(2, Math.ceil((endAngle - startAngle) / 0.12));

        for (let index = 0; index <= steps; index += 1) {
          const angle = Geometry.lerp(startAngle, endAngle, index / steps);
          const x = center.x + Math.cos(angle) * radius;
          const y = center.y + Math.sin(angle) * radius;
          if (index === 0) {
            graphics.moveTo(x, y);
          } else {
            graphics.lineTo(x, y);
          }
        }

        traveled += dashArcLength + gapArcLength;
      }
    }

    syncCars(cars) {
      const validIds = new Set(cars.map((car) => car.id));

      Array.from(this.carViews.keys()).forEach((carId) => {
        if (!validIds.has(carId)) {
          const view = this.carViews.get(carId);
          this.trailLayer.removeChild(view.trail);
          this.envelopeLayer.removeChild(view.envelope);
          this.carLayer.removeChild(view.container);
          this.carViews.delete(carId);
        }
      });

      cars.forEach((car) => {
        if (!this.carViews.has(car.id)) {
          const view = this.createCarView(car);
          this.carViews.set(car.id, view);
          this.trailLayer.addChild(view.trail);
          this.envelopeLayer.addChild(view.envelope);
          this.carLayer.addChild(view.container);
        }
      });
    }

    createCarView(car) {
      const container = new PIXI.Container();
      const trail = new PIXI.Graphics();
      const envelope = new PIXI.Graphics();
      const body = new PIXI.Graphics();
      const roof = new PIXI.Graphics();
      const nose = new PIXI.Graphics();

      body.lineStyle(0.05, 0x08131c, 0.9);
      body.beginFill(car.color, 1);
      body.drawRoundedRect(-car.vehicle.length / 2, -car.vehicle.width / 2, car.vehicle.length, car.vehicle.width, 0.22);
      body.endFill();

      roof.beginFill(0xeaf4ff, 0.18);
      roof.drawRoundedRect(-car.vehicle.length * 0.18, -car.vehicle.width * 0.26, car.vehicle.length * 0.48, car.vehicle.width * 0.52, 0.16);
      roof.endFill();

      nose.beginFill(0xf8fbff, 0.28);
      nose.drawRoundedRect(car.vehicle.length * 0.12, -car.vehicle.width * 0.34, car.vehicle.length * 0.26, car.vehicle.width * 0.68, 0.16);
      nose.endFill();

      container.addChild(body);
      container.addChild(roof);
      container.addChild(nose);

      const wheelViews = {};
      [
        { key: "rearLeft", axleX: -car.vehicle.bodyCenterOffset, side: -1 },
        { key: "rearRight", axleX: -car.vehicle.bodyCenterOffset, side: 1 },
        { key: "frontLeft", axleX: car.vehicle.wheelBase - car.vehicle.bodyCenterOffset, side: -1 },
        { key: "frontRight", axleX: car.vehicle.wheelBase - car.vehicle.bodyCenterOffset, side: 1 }
      ].forEach((wheelConfig) => {
        const wheel = new PIXI.Graphics();
        wheel.beginFill(0x11161d, 1);
        wheel.drawRoundedRect(-0.22, -0.07, 0.44, 0.14, 0.06);
        wheel.endFill();
        wheel.position.set(wheelConfig.axleX, wheelConfig.side * car.vehicle.width * 0.34);
        container.addChild(wheel);
        wheelViews[wheelConfig.key] = wheel;
      });

      const label = new PIXI.Text(car.label, {
        fill: tintToHex(car.color),
        fontFamily: NS.Config.fonts.mono,
        fontSize: 0.32 * this.scale,
        fontWeight: "600"
      });
      label.anchor.set(0.5, 1.3);
      label.scale.set(1 / this.scale);
      container.addChild(label);

      return { container, trail, envelope, wheels: wheelViews };
    }

    render(cars, options) {
      if (!this.layout) return;
      this.syncCars(cars);
      this.debugLayer.clear();
      this.layout.clearOccupancy();

      cars.forEach((car) => {
        if (car.isParked() && car.targetSpotIndex != null) {
          this.layout.markOccupied(car.targetSpotIndex, car.id);
        }
      });

      this.drawLayout();

      cars.forEach((car) => {
        const view = this.carViews.get(car.id);
        if (!view) return;

        const center = car.getBodyCenter();
        const isVisible = !car.isExited();
        view.container.visible = isVisible;
        view.container.position.set(center.x, center.y);
        view.container.rotation = car.heading;
        view.wheels.frontLeft.rotation = car.steering;
        view.wheels.frontRight.rotation = car.steering;

        this.drawHistory(view.trail, car.trail, car.color, options.showTrails, 0.07);
        this.drawEnvelope(view.envelope, car, options.showEnvelope);

        if (options.showDebug) {
          this.drawDebugForCar(car);
        }
      });
    }

    drawHistory(graphics, points, color, visible, lineWidth) {
      graphics.clear();
      graphics.visible = visible;
      if (!visible || points.length < 2) return;
      graphics.lineStyle(lineWidth, color, 0.62);
      graphics.moveTo(points[0].x, points[0].y);
      for (let index = 1; index < points.length; index += 1) {
        graphics.lineTo(points[index].x, points[index].y);
      }
    }

    drawEnvelope(graphics, car, visible) {
      graphics.clear();
      graphics.visible = visible;
      if (!visible || car.envelopeLeft.length < 2) return;
      graphics.lineStyle(0.05, car.color, 0.22);
      graphics.moveTo(car.envelopeLeft[0].x, car.envelopeLeft[0].y);
      for (let index = 1; index < car.envelopeLeft.length; index += 1) {
        graphics.lineTo(car.envelopeLeft[index].x, car.envelopeLeft[index].y);
      }
      graphics.moveTo(car.envelopeRight[0].x, car.envelopeRight[0].y);
      for (let index = 1; index < car.envelopeRight.length; index += 1) {
        graphics.lineTo(car.envelopeRight[index].x, car.envelopeRight[index].y);
      }
    }

    drawDebugForCar(car) {
      const rear = car.getRearAxlePosition();
      const front = car.getFrontAxlePosition();
      const center = car.getBodyCenter();
      const forward = { x: Math.cos(car.heading), y: Math.sin(car.heading) };

      this.debugLayer.lineStyle(0.05, colors.debug, 0.9);
      this.debugLayer.beginFill(colors.debug, 1);
      this.debugLayer.drawCircle(rear.x, rear.y, 0.08);
      this.debugLayer.drawCircle(front.x, front.y, 0.08);
      this.debugLayer.endFill();
      this.debugLayer.moveTo(center.x, center.y);
      this.debugLayer.lineTo(center.x + forward.x * 1.25, center.y + forward.y * 1.25);

      if (Math.abs(car.steering) > 0.04) {
        const turningRadius = car.vehicle.wheelBase / Math.tan(car.steering);
        const normal = { x: -Math.sin(car.heading), y: Math.cos(car.heading) };
        const icc = {
          x: rear.x + normal.x * turningRadius,
          y: rear.y + normal.y * turningRadius
        };
        this.debugLayer.lineStyle(0.04, colors.laneGuide, 0.24);
        this.debugLayer.drawCircle(icc.x, icc.y, Math.abs(turningRadius));
      }
    }
  }

  NS.SceneRenderer = SceneRenderer;
})(window.ParkingSim);
