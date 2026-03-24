window.ParkingSim = window.ParkingSim || {};

(function initializeLayout(NS) {
  const Geometry = NS.GeometryUtils;

  class GarageLayout {
    constructor(settings, vehicle) {
      this.update(settings, vehicle);
    }

    update(settings, vehicle) {
      this.settings = Object.assign({}, settings);
      this.vehicle = Object.assign({}, vehicle);
      this.build();
    }

    build() {
      const s = this.settings;
      const laneLeft = s.leftMargin;
      const laneCenterX = laneLeft + s.laneWidth / 2;
      const spotGap = 0.35;
      const spotStackHeight = s.spotCount * s.spotWidth + Math.max(0, s.spotCount - 1) * spotGap;
      const bayTopPadding = 1.35;
      const bayBottomPadding = 1.2;
      const bayHeight = spotStackHeight + bayTopPadding + bayBottomPadding;
      const bayTop = Math.max(1.0, s.topMargin - 1.0);
      const bayBottom = bayTop + bayHeight;
      const turnRadius = Math.min(
        Math.max(this.vehicle.minTurningRadius * 0.98, s.laneWidth + 1.15),
        bayHeight - 1.2
      );
      const laneTop = bayBottom;
      const queueTail = s.queueSpacing * Math.max(0, s.spotCount - 1);
      const laneHeight = s.approachLength + queueTail;
      const lowerManeuverHeight = Math.max(this.vehicle.minTurningRadius + this.vehicle.length * 1.1, 10.8);
      const lowerManeuverLeft = Math.max(1.2, laneLeft - 1.0);
      const turnCenter = {
        x: laneCenterX + turnRadius,
        y: laneTop
      };
      const turnStart = {
        x: laneCenterX,
        y: laneTop
      };
      const turnEnd = {
        x: laneCenterX + turnRadius,
        y: laneTop - turnRadius
      };
      const spotX = turnEnd.x + s.transitionLength;
      const maneuverRight = spotX;
      const worldHeight = laneTop + laneHeight + s.bottomMargin;
      const exitApronWidth = Math.max(this.vehicle.minTurningRadius + 3.2, s.maneuverWidth * 1.12);
      const worldWidth = spotX + s.spotDepth + exitApronWidth + s.rightMargin;

      this.laneRect = {
        x: laneLeft,
        y: laneTop,
        width: s.laneWidth,
        height: laneHeight
      };
      this.aisleRect = {
        x: laneLeft,
        y: bayTop,
        width: maneuverRight - laneLeft,
        height: bayHeight
      };

      this.dimensions = {
        worldWidth,
        worldHeight,
        laneCenterX,
        bayTop,
        bayBottom,
        bayHeight,
        turnRadius,
        turnCenter,
        turnStart,
        turnEnd,
        spotX,
        exitApronWidth
      };

      this.driveableRects = [this.laneRect, this.aisleRect];
      this.spots = [];
      this.gapRects = [];

      for (let index = 0; index < s.spotCount; index += 1) {
        const rect = {
          id: index,
          number: index + 1,
          x: spotX,
          y: bayTop + bayTopPadding + index * (s.spotWidth + spotGap),
          width: s.spotDepth,
          height: s.spotWidth,
          occupiedBy: null
        };

        rect.center = {
          x: rect.x + rect.width / 2,
          y: rect.y + rect.height / 2
        };

        this.spots.push(rect);
        this.driveableRects.push(rect);

        if (index < s.spotCount - 1 && spotGap > 0) {
          const gapRect = {
            x: spotX,
            y: rect.y + rect.height,
            width: s.spotDepth,
            height: spotGap
          };
          this.gapRects.push(gapRect);
          this.driveableRects.push(gapRect);
        }
      }

      this.topApronRect = {
        x: spotX,
        y: bayTop,
        width: s.spotDepth,
        height: bayTopPadding
      };
      this.upperApronRect = {
        x: spotX,
        y: bayTop - 0.45,
        width: s.spotDepth,
        height: 0.45
      };
      this.bottomApronRect = {
        x: spotX,
        y: bayTop + bayTopPadding + spotStackHeight,
        width: s.spotDepth,
        height: bayBottomPadding
      };
      this.exitRect = {
        x: spotX + s.spotDepth,
        y: bayTop - 0.45,
        width: exitApronWidth,
        height: Math.max(bayHeight + 0.9, lowerManeuverHeight + laneTop - (bayTop - 0.45) - 0.2)
      };
      this.lowerManeuverRect = {
        x: lowerManeuverLeft,
        y: laneTop - 0.2,
        width: this.exitRect.x + this.exitRect.width - lowerManeuverLeft,
        height: lowerManeuverHeight
      };
      this.driveableRects.push(this.exitRect);
      this.driveableRects.push(this.upperApronRect);
      this.driveableRects.push(this.topApronRect);
      this.driveableRects.push(this.bottomApronRect);
      this.driveableRects.push(this.lowerManeuverRect);

      this.entryArrow = {
        from: {
          x: laneCenterX,
          y: laneTop + s.approachLength - 1.4
        },
        to: {
          x: laneCenterX,
          y: laneTop + s.approachLength - 3.5
        }
      };
    }

    clearOccupancy() {
      this.spots.forEach((spot) => {
        spot.occupiedBy = null;
      });
    }

    markOccupied(spotIndex, carId) {
      const spot = this.spots[spotIndex];
      if (spot) {
        spot.occupiedBy = carId;
      }
    }

    getSpawnPose(queueIndex) {
      const queueTail = this.settings.queueSpacing * Math.max(0, this.settings.spotCount - 1);
      return {
        x: this.dimensions.laneCenterX,
        y: this.laneRect.y + this.laneRect.height - 2 - queueTail + queueIndex * this.settings.queueSpacing,
        heading: -Math.PI / 2
      };
    }

    getTurnGuidePath() {
      const guideEnd = {
        x: this.dimensions.spotX - 0.8,
        y: this.dimensions.turnEnd.y
      };

      return Geometry.stitchPaths([
        Geometry.sampleLine(
          { x: this.dimensions.laneCenterX, y: this.laneRect.y + this.laneRect.height - 4 },
          this.dimensions.turnStart,
          0.5
        ),
        Geometry.sampleArc(
          this.dimensions.turnCenter,
          this.dimensions.turnRadius,
          -Math.PI,
          -Math.PI / 2,
          { clockwise: false, step: 0.28 }
        ),
        Geometry.sampleLine(this.dimensions.turnEnd, guideEnd, 0.4)
      ]);
    }

    buildAutoPlan(spotIndex, spawnPose) {
      const spot = this.spots[spotIndex];
      const approachOffset = 0.85;
      const alignmentLaneY = spot.center.y + approachOffset;
      const stagingPoint = {
        x: Math.max(this.dimensions.turnEnd.x + 2.2, spot.x - 0.65),
        y: alignmentLaneY
      };
      const alignmentPath = spotIndex === 0
        ? Geometry.sampleLine(this.dimensions.turnEnd, stagingPoint, 0.24)
        : Geometry.stitchPaths([
            Geometry.sampleLine(
              this.dimensions.turnEnd,
              { x: this.dimensions.turnEnd.x + 0.45, y: alignmentLaneY },
              0.2
            ),
            Geometry.sampleLine(
              { x: this.dimensions.turnEnd.x + 0.45, y: alignmentLaneY },
              stagingPoint,
              0.2
            )
          ]);
      const finalRearAxle = {
        x: spot.x + spot.width - (this.vehicle.wheelBase + this.vehicle.frontOverhang) - 0.25,
        y: spot.center.y
      };

      return {
        spotIndex,
        flow: "ARRIVAL",
        finalPose: {
          x: finalRearAxle.x,
          y: finalRearAxle.y,
          heading: 0
        },
        states: {
          APPROACH: {
            path: Geometry.sampleLine(spawnPose, this.dimensions.turnStart, 0.45),
            targetSpeed: 3.1,
            lookAhead: 2.4,
            endTolerance: 0.42,
            desiredHeading: -Math.PI / 2,
            next: "TURNING"
          },
          TURNING: {
            path: Geometry.sampleArc(
              this.dimensions.turnCenter,
              this.dimensions.turnRadius,
              -Math.PI,
              -Math.PI / 2,
              { clockwise: false, step: 0.25 }
            ),
            targetSpeed: 2.3,
            lookAhead: 1.95,
            endTolerance: 0.34,
            desiredHeading: 0,
            next: "ALIGNING"
          },
          ALIGNING: {
            path: alignmentPath,
            targetSpeed: 1.15,
            lookAhead: 0.95,
            endTolerance: 0.18,
            desiredHeading: 0,
            next: "ENTERING_SPOT"
          },
          ENTERING_SPOT: {
            path: Geometry.sampleLine(stagingPoint, finalRearAxle, 0.14),
            targetSpeed: 0.82,
            lookAhead: 0.72,
            endTolerance: 0.12,
            desiredHeading: 0,
            stopAtEnd: true,
            next: "PARKED"
          }
        }
      };
    }

    buildExitPlan(spotIndex, startPose) {
      const spot = this.spots[spotIndex];
      const sweepRadius = this.vehicle.minTurningRadius + 0.08;
      const exitForward = {
        x: this.exitRect.x + 0.9,
        y: spot.center.y
      };
      const turnCenter = {
        x: exitForward.x,
        y: exitForward.y + sweepRadius
      };
      const arcEnd = {
        x: turnCenter.x + sweepRadius,
        y: turnCenter.y
      };
      const southPoint = {
        x: arcEnd.x,
        y: this.laneRect.y + 4.2
      };
      const laneEntry = {
        x: this.dimensions.laneCenterX,
        y: this.laneRect.y + Math.min(this.lowerManeuverRect.height - 3.0, 7.0)
      };
      const mergeControl1 = {
        x: southPoint.x,
        y: this.lowerManeuverRect.y + this.lowerManeuverRect.height - 1.0
      };
      const mergeControl2 = {
        x: laneEntry.x,
        y: this.lowerManeuverRect.y + this.lowerManeuverRect.height - 1.8
      };
      const laneExit = {
        x: this.dimensions.laneCenterX,
        y: this.laneRect.y + this.laneRect.height - (this.vehicle.wheelBase + this.vehicle.frontOverhang) - 0.45
      };

      return {
        spotIndex,
        flow: "DEPARTURE",
        finalPose: {
          x: laneExit.x,
          y: laneExit.y,
          heading: Math.PI / 2
        },
        states: {
          EXIT_FORWARD: {
            path: Geometry.sampleLine(startPose, exitForward, 0.16),
            targetSpeed: 0.95,
            lookAhead: 0.72,
            endTolerance: 0.12,
            desiredHeading: 0,
            next: "EXIT_SWEEP"
          },
          EXIT_SWEEP: {
            path: Geometry.stitchPaths([
              Geometry.sampleArc(turnCenter, sweepRadius, -Math.PI / 2, 0, {
                clockwise: false,
                step: 0.16
              }),
              Geometry.sampleLine(arcEnd, southPoint, 0.16)
            ]),
            targetSpeed: 0.98,
            lookAhead: 0.8,
            endTolerance: 0.16,
            desiredHeading: Math.PI / 2,
            next: "RETURN_TO_ACCESS"
          },
          RETURN_TO_ACCESS: {
            path: Geometry.sampleCubicBezier(
              southPoint,
              mergeControl1,
              mergeControl2,
              laneEntry,
              0.16
            ),
            targetSpeed: 1.0,
            lookAhead: 0.86,
            endTolerance: 0.18,
            desiredHeading: Math.PI / 2,
            assistPose: {
              x: laneEntry.x,
              y: laneEntry.y,
              heading: Math.PI / 2
            },
            assistDistance: 2.4,
            assistNext: "EXIT_LANE",
            next: "EXIT_LANE"
          },
          EXIT_LANE: {
            path: Geometry.sampleLine(laneEntry, laneExit, 0.3),
            targetSpeed: 2.45,
            lookAhead: 1.3,
            endTolerance: 0.25,
            desiredHeading: Math.PI / 2,
            stopAtEnd: true,
            next: "EXITED"
          }
        }
      };
    }

    getContainmentSamples(polygon) {
      const samples = polygon.slice();
      for (let index = 0; index < polygon.length; index += 1) {
        samples.push(Geometry.midpoint(polygon[index], polygon[(index + 1) % polygon.length]));
      }
      return samples;
    }

    isPolygonInsideDriveable(polygon) {
      return this.getContainmentSamples(polygon).every((point) => Geometry.pointInUnionRects(point, this.driveableRects));
    }

    getMetrics(vehicle) {
      return {
        laneWidth: this.settings.laneWidth,
        maneuverWidth: this.settings.maneuverWidth,
        spotWidth: this.settings.spotWidth,
        spotDepth: this.settings.spotDepth,
        carLength: vehicle.length,
        carWidth: vehicle.width,
        wheelBase: vehicle.wheelBase,
        minTurningRadius: vehicle.minTurningRadius
      };
    }
  }

  NS.GarageLayout = GarageLayout;
})(window.ParkingSim);
