window.ParkingSim = window.ParkingSim || {};

(function initializeCar(NS) {
  const Geometry = NS.GeometryUtils;

  class Car {
    constructor(config) {
      this.id = config.id;
      this.label = config.label;
      this.color = config.color;
      this.vehicle = Object.assign({}, config.vehicle);
      this.layout = config.layout;
      this.mode = config.mode || "AUTO";
      this.targetSpotIndex = config.targetSpotIndex != null ? config.targetSpotIndex : null;
      this.spawnPose = Object.assign({}, config.spawnPose);
      this.autoPlan = config.autoPlan || null;
      this.exited = false;
      this.reset(this.spawnPose);
    }

    reset(pose) {
      this.x = pose.x;
      this.y = pose.y;
      this.heading = pose.heading;
      this.speed = 0;
      this.steering = 0;
      this.state = this.mode === "AUTO" ? "WAITING" : "MANUAL";
      this.pathCursor = 0;
      this.trail = [];
      this.envelopeLeft = [];
      this.envelopeRight = [];
      this.blocked = false;
      this.blockedReason = "";
      this.parked = false;
      this.exited = false;
      this.settleProgress = 0;
      this.settleStartPose = null;
      this.settleTargetPose = null;
      this.settleCompletionState = null;
      this.recordMotion(true);
    }

    startAuto() {
      if (this.mode === "AUTO" && this.state === "WAITING") {
        this.state = "APPROACH";
        this.pathCursor = 0;
      }
    }

    isWaiting() {
      return this.state === "WAITING";
    }

    isParked() {
      return this.state === "PARKED";
    }

    isExited() {
      return this.state === "EXITED";
    }

    startExit(exitPlan) {
      if (this.mode !== "AUTO" || !this.isParked()) {
        return;
      }

      this.autoPlan = exitPlan;
      this.state = "EXIT_FORWARD";
      this.pathCursor = 0;
      this.parked = false;
      this.exited = false;
      this.settleProgress = 0;
      this.settleStartPose = null;
      this.settleTargetPose = null;
      this.settleCompletionState = null;
    }

    getRearAxlePosition() {
      return { x: this.x, y: this.y };
    }

    getHeadingVector(heading) {
      return { x: Math.cos(heading), y: Math.sin(heading) };
    }

    getBodyCenter(pose) {
      const source = pose || this;
      const forward = this.getHeadingVector(source.heading);
      return {
        x: source.x + forward.x * this.vehicle.bodyCenterOffset,
        y: source.y + forward.y * this.vehicle.bodyCenterOffset
      };
    }

    getPolygon(pose) {
      const source = pose || this;
      return Geometry.getRectangleVertices(
        this.getBodyCenter(source),
        this.vehicle.length,
        this.vehicle.width,
        source.heading
      );
    }

    getCollisionPolygon(pose) {
      const source = pose || this;
      return Geometry.getRectangleVertices(
        this.getBodyCenter(source),
        Math.max(this.vehicle.length - 0.8, this.vehicle.wheelBase + 0.55),
        Math.max(this.vehicle.width - 0.45, this.vehicle.width * 0.72),
        source.heading
      );
    }

    getFrontAxlePosition(pose) {
      const source = pose || this;
      const forward = this.getHeadingVector(source.heading);
      return {
        x: source.x + forward.x * this.vehicle.wheelBase,
        y: source.y + forward.y * this.vehicle.wheelBase
      };
    }

    getTelemetry() {
      return {
        label: this.label,
        state: this.state,
        speed: this.speed,
        steering: this.steering,
        heading: this.heading
      };
    }

    update(dt, context) {
      this.blocked = false;
      this.blockedReason = "";
      if (this.mode === "AUTO") {
        this.updateAutomatic(dt, context);
      } else {
        this.updateManual(dt, context);
      }
    }

    updateAutomatic(dt, context) {
      if (this.state === "SETTLING") {
        this.updateSettling(dt);
        return;
      }

      if (this.state === "WAITING" || this.state === "PARKED" || this.state === "EXITED") {
        if (this.state === "PARKED") this.parked = true;
        if (this.state === "EXITED") this.exited = true;
        return;
      }

      const segment = this.autoPlan.states[this.state];
      if (!segment) return;

      const control = this.computePathControl(segment, context.baseLookAhead);
      const candidate = this.integrateKinematics(dt, control.targetSpeed, control.targetSteering);

      if (this.canCommitCandidate(candidate, context)) {
        this.commit(candidate);
        if (this.shouldAssistSegment(segment, this)) {
          this.startSettling(this, segment.assistPose, segment.assistNext || segment.next);
          return;
        }
        this.maybeAdvanceState(segment);
        if (this.shouldAssistParking(this)) {
          this.startSettling(this, this.autoPlan.finalPose, "PARKED");
        }
      } else {
        if (this.shouldAssistSegment(segment, this)) {
          this.startSettling(this, segment.assistPose, segment.assistNext || segment.next);
        } else if (this.shouldAssistParking(candidate)) {
          this.startSettling(candidate, this.autoPlan.finalPose, "PARKED");
        } else {
          this.speed = 0;
          this.blocked = true;
          this.blockedReason = "Bloqueado";
        }
      }
    }

    updateManual(dt, context) {
      const keys = context.keys;
      const forwardInput = (keys.forward ? 1 : 0) - (keys.backward ? 1 : 0);
      const steerInput = (keys.right ? 1 : 0) - (keys.left ? 1 : 0);
      const desiredSpeed = forwardInput * this.vehicle.maxSpeed * 0.88;
      let acceleration;

      if (forwardInput === 0) {
        acceleration = -Math.sign(this.speed) * Math.min(Math.abs(this.speed) * this.vehicle.drag, this.vehicle.maxBrake * 0.6);
      } else {
        acceleration = Geometry.clamp((desiredSpeed - this.speed) * 2.4, -this.vehicle.maxBrake, this.vehicle.maxAccel);
      }

      if (keys.brake) {
        acceleration += -Math.sign(this.speed || desiredSpeed || 1) * this.vehicle.maxBrake;
      }

      const steerScale = Math.min(1, Math.max(0.35, 1 - Math.abs(this.speed) / (this.vehicle.maxSpeed * 1.4)));
      const targetSteering = steerInput * this.vehicle.maxSteeringRad * steerScale;
      const candidate = this.integrateKinematics(dt, this.speed + acceleration * dt, targetSteering, {
        absoluteSpeedTarget: true
      });

      if (this.canCommitCandidate(candidate, context)) {
        this.commit(candidate);
      } else {
        this.speed = 0;
        this.blocked = true;
        this.blockedReason = "Colisão ou limite";
      }
    }

    computePathControl(segment, baseLookAhead) {
      const path = segment.path;
      let closestIndex = this.pathCursor;
      let closestDistance = Infinity;
      const searchLimit = Math.min(path.length - 1, this.pathCursor + 18);

      for (let index = this.pathCursor; index <= searchLimit; index += 1) {
        const distance = Geometry.distance(this.getRearAxlePosition(), path[index]);
        if (distance < closestDistance) {
          closestDistance = distance;
          closestIndex = index;
        }
      }

      this.pathCursor = closestIndex;
      const lookAheadDistance = Math.max(segment.lookAhead || baseLookAhead, Math.abs(this.speed) * 0.55 + baseLookAhead * 0.7);
      let lookAheadPoint = path[path.length - 1];
      let traveled = 0;

      for (let index = closestIndex; index < path.length - 1; index += 1) {
        const current = path[index];
        const next = path[index + 1];
        traveled += Geometry.distance(current, next);
        if (traveled >= lookAheadDistance) {
          lookAheadPoint = next;
          break;
        }
      }

      const targetHeading = Math.atan2(lookAheadPoint.y - this.y, lookAheadPoint.x - this.x);
      const alpha = Geometry.shortestAngleDiff(targetHeading, this.heading);
      const targetSteering = Geometry.clamp(
        Math.atan2(2 * this.vehicle.wheelBase * Math.sin(alpha), Math.max(lookAheadDistance, 0.35)),
        -this.vehicle.maxSteeringRad,
        this.vehicle.maxSteeringRad
      );

      const endPoint = path[path.length - 1];
      const distanceToEnd = Geometry.distance(this.getRearAxlePosition(), endPoint);
      const slowdownStart = segment.stopAtEnd ? 2.0 : 1.2;
      let targetSpeed = segment.targetSpeed;
      if (distanceToEnd < slowdownStart) {
        targetSpeed *= Geometry.clamp(distanceToEnd / slowdownStart, 0.18, 1);
      }

      return { targetSpeed, targetSteering };
    }

    integrateKinematics(dt, speedTarget, steeringTarget, options) {
      const config = Object.assign({ absoluteSpeedTarget: false }, options || {});
      const targetSpeed = config.absoluteSpeedTarget
        ? Geometry.clamp(speedTarget, -this.vehicle.maxSpeed, this.vehicle.maxSpeed)
        : speedTarget;
      const speedDelta = targetSpeed - this.speed;
      const accelLimit = speedDelta >= 0 ? this.vehicle.maxAccel : this.vehicle.maxBrake;
      const nextSpeed = config.absoluteSpeedTarget
        ? targetSpeed
        : this.speed + Geometry.clamp(speedDelta, -accelLimit * dt, accelLimit * dt);
      const nextSteering = this.steering + Geometry.clamp(
        steeringTarget - this.steering,
        -this.vehicle.steeringRate * dt,
        this.vehicle.steeringRate * dt
      );
      const yawRate = Math.abs(nextSteering) > 1e-4 ? (nextSpeed / this.vehicle.wheelBase) * Math.tan(nextSteering) : 0;
      const nextHeading = Geometry.normalizeAngle(this.heading + yawRate * dt);
      return {
        x: this.x + nextSpeed * Math.cos(nextHeading) * dt,
        y: this.y + nextSpeed * Math.sin(nextHeading) * dt,
        heading: nextHeading,
        speed: nextSpeed,
        steering: nextSteering
      };
    }

    canCommitCandidate(candidate, context) {
      const polygon = this.getPolygon(candidate);
      if (!this.layout.isPolygonInsideDriveable(polygon)) {
        return false;
      }

      const collisionPolygon = this.getCollisionPolygon(candidate);

      for (let index = 0; index < context.cars.length; index += 1) {
        const other = context.cars[index];
        if (other.id === this.id) continue;
        if (other.isExited()) continue;
        if (this.mode === "AUTO" && other.isParked()) continue;
        if (Geometry.polygonsIntersect(collisionPolygon, other.getCollisionPolygon())) {
          return false;
        }
      }

      return true;
    }

    commit(candidate) {
      this.x = candidate.x;
      this.y = candidate.y;
      this.heading = candidate.heading;
      this.speed = candidate.speed;
      this.steering = candidate.steering;
      this.recordMotion(false);
    }

    maybeAdvanceState(segment) {
      const endPoint = segment.path[segment.path.length - 1];
      const closeEnough = Geometry.distance(this.getRearAxlePosition(), endPoint) <= (segment.endTolerance || 0.25);
      const headingOkay = segment.desiredHeading == null || Math.abs(Geometry.shortestAngleDiff(segment.desiredHeading, this.heading)) < 0.16;
      if (!closeEnough || !headingOkay) return;

      if (segment.next === "PARKED" || segment.next === "EXITED") {
        this.speed = 0;
        this.state = segment.next;
        this.parked = segment.next === "PARKED";
        this.exited = segment.next === "EXITED";
        return;
      }

      this.state = segment.next;
      this.pathCursor = 0;
    }

    shouldAssistSegment(segment, pose) {
      if (!segment || !segment.assistPose) {
        return false;
      }

      const source = pose || this;
      return Geometry.distance(source, segment.assistPose) <= (segment.assistDistance || 1.6);
    }

    shouldAssistParking(pose) {
      if (
        !this.autoPlan ||
        !this.autoPlan.finalPose ||
        this.state !== "ENTERING_SPOT"
      ) {
        return false;
      }

      const target = this.autoPlan.finalPose;
      const source = pose || this;
      const distanceToTarget = Geometry.distance(source, target);
      const headingError = Math.abs(Geometry.shortestAngleDiff(target.heading, source.heading));
      return distanceToTarget < 0.16 && headingError < 0.05;
    }

    startSettling(startPose, targetPose, completionState) {
      this.state = "SETTLING";
      this.settleProgress = 0;
      this.settleStartPose = {
        x: startPose.x,
        y: startPose.y,
        heading: startPose.heading,
        steering: startPose.steering,
        speed: startPose.speed || this.speed
      };
      this.settleTargetPose = Object.assign({}, targetPose || this.autoPlan.finalPose, {
        steering: 0,
        speed: 0
      });
      this.settleCompletionState = completionState || "PARKED";
      this.parked = false;
      this.exited = false;
      this.blocked = false;
      this.blockedReason = "";
    }

    updateSettling(dt) {
      this.settleProgress = Math.min(1, this.settleProgress + dt / 1.2);
      const eased = this.settleProgress * this.settleProgress * (3 - 2 * this.settleProgress);
      const headingDelta = Geometry.shortestAngleDiff(this.settleTargetPose.heading, this.settleStartPose.heading);

      this.x = Geometry.lerp(this.settleStartPose.x, this.settleTargetPose.x, eased);
      this.y = Geometry.lerp(this.settleStartPose.y, this.settleTargetPose.y, eased);
      this.heading = Geometry.normalizeAngle(this.settleStartPose.heading + headingDelta * eased);
      this.steering = Geometry.lerp(this.settleStartPose.steering, 0, eased);
      this.speed = Geometry.lerp(Math.abs(this.settleStartPose.speed || 0.4), 0, eased);
      this.recordMotion(false);

      if (this.settleProgress >= 1) {
        this.speed = 0;
        this.steering = 0;
        this.state = this.settleCompletionState || "PARKED";
        this.pathCursor = 0;
        this.parked = this.state === "PARKED";
        this.exited = this.state === "EXITED";
        this.settleCompletionState = null;
      }
    }

    recordMotion(force) {
      const center = this.getBodyCenter();
      const polygon = this.getPolygon();
      const frontLeft = polygon[1];
      const frontRight = polygon[2];

      if (force || this.trail.length === 0 || Geometry.distance(this.trail[this.trail.length - 1], center) > 0.16) {
        this.trail.push(center);
      }
      if (force || this.envelopeLeft.length === 0 || Geometry.distance(this.envelopeLeft[this.envelopeLeft.length - 1], frontLeft) > 0.16) {
        this.envelopeLeft.push(frontLeft);
        this.envelopeRight.push(frontRight);
      }
    }

    trimHistory(maxTrailPoints, maxEnvelopePoints) {
      if (this.trail.length > maxTrailPoints) {
        this.trail.splice(0, this.trail.length - maxTrailPoints);
      }
      if (this.envelopeLeft.length > maxEnvelopePoints) {
        this.envelopeLeft.splice(0, this.envelopeLeft.length - maxEnvelopePoints);
        this.envelopeRight.splice(0, this.envelopeRight.length - maxEnvelopePoints);
      }
    }
  }

  NS.Car = Car;
})(window.ParkingSim);
