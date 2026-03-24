window.ParkingSim = window.ParkingSim || {};

(function initializeGeometry(NS) {
  const GeometryUtils = {
    clamp(value, min, max) {
      return Math.min(Math.max(value, min), max);
    },

    lerp(start, end, t) {
      return start + (end - start) * t;
    },

    distance(a, b) {
      return Math.hypot(b.x - a.x, b.y - a.y);
    },

    normalizeAngle(angle) {
      let output = angle;
      while (output > Math.PI) output -= Math.PI * 2;
      while (output < -Math.PI) output += Math.PI * 2;
      return output;
    },

    shortestAngleDiff(target, current) {
      return this.normalizeAngle(target - current);
    },

    toDegrees(radians) {
      return (radians * 180) / Math.PI;
    },

    rotatePoint(point, angle) {
      const cos = Math.cos(angle);
      const sin = Math.sin(angle);
      return {
        x: point.x * cos - point.y * sin,
        y: point.x * sin + point.y * cos
      };
    },

    getRectangleVertices(center, width, height, angle) {
      const halfWidth = width / 2;
      const halfHeight = height / 2;
      const localPoints = [
        { x: -halfWidth, y: -halfHeight },
        { x: halfWidth, y: -halfHeight },
        { x: halfWidth, y: halfHeight },
        { x: -halfWidth, y: halfHeight }
      ];

      return localPoints.map((point) => {
        const rotated = this.rotatePoint(point, angle);
        return {
          x: rotated.x + center.x,
          y: rotated.y + center.y
        };
      });
    },

    midpoint(a, b) {
      return {
        x: (a.x + b.x) / 2,
        y: (a.y + b.y) / 2
      };
    },

    getPolygonAxes(polygon) {
      const axes = [];
      for (let index = 0; index < polygon.length; index += 1) {
        const current = polygon[index];
        const next = polygon[(index + 1) % polygon.length];
        const edge = {
          x: next.x - current.x,
          y: next.y - current.y
        };
        const normal = { x: -edge.y, y: edge.x };
        const magnitude = Math.hypot(normal.x, normal.y) || 1;
        axes.push({
          x: normal.x / magnitude,
          y: normal.y / magnitude
        });
      }
      return axes;
    },

    projectPolygon(polygon, axis) {
      let min = Infinity;
      let max = -Infinity;
      polygon.forEach((point) => {
        const projection = point.x * axis.x + point.y * axis.y;
        min = Math.min(min, projection);
        max = Math.max(max, projection);
      });
      return { min, max };
    },

    polygonsIntersect(polygonA, polygonB) {
      const axes = this.getPolygonAxes(polygonA).concat(this.getPolygonAxes(polygonB));
      for (let index = 0; index < axes.length; index += 1) {
        const axis = axes[index];
        const projectionA = this.projectPolygon(polygonA, axis);
        const projectionB = this.projectPolygon(polygonB, axis);
        if (projectionA.max < projectionB.min || projectionB.max < projectionA.min) {
          return false;
        }
      }
      return true;
    },

    pointInRect(point, rect, tolerance) {
      const slack = tolerance != null ? tolerance : 0.15;
      return (
        point.x >= rect.x - slack &&
        point.x <= rect.x + rect.width + slack &&
        point.y >= rect.y - slack &&
        point.y <= rect.y + rect.height + slack
      );
    },

    pointInUnionRects(point, rects) {
      return rects.some((rect) => this.pointInRect(point, rect));
    },

    sampleLine(start, end, step) {
      const length = this.distance(start, end);
      const points = [];
      const count = Math.max(1, Math.ceil(length / step));
      for (let index = 0; index <= count; index += 1) {
        const t = index / count;
        points.push({
          x: this.lerp(start.x, end.x, t),
          y: this.lerp(start.y, end.y, t)
        });
      }
      return points;
    },

    sampleArc(center, radius, startAngle, endAngle, options) {
      const config = Object.assign({ clockwise: false, step: 0.28 }, options || {});
      let start = startAngle;
      let end = endAngle;

      if (config.clockwise && start < end) {
        start += Math.PI * 2;
      }
      if (!config.clockwise && end < start) {
        end += Math.PI * 2;
      }

      const sweep = config.clockwise ? start - end : end - start;
      const count = Math.max(4, Math.ceil(Math.abs(radius * sweep) / config.step));
      const points = [];

      for (let index = 0; index <= count; index += 1) {
        const t = index / count;
        const angle = config.clockwise ? start - sweep * t : start + sweep * t;
        points.push({
          x: center.x + radius * Math.cos(angle),
          y: center.y + radius * Math.sin(angle)
        });
      }

      return points;
    },

    sampleCubicBezier(start, control1, control2, end, step) {
      const pathLengthEstimate =
        this.distance(start, control1) +
        this.distance(control1, control2) +
        this.distance(control2, end);
      const count = Math.max(12, Math.ceil(pathLengthEstimate / (step || 0.2)));
      const points = [];

      for (let index = 0; index <= count; index += 1) {
        const t = index / count;
        const mt = 1 - t;
        points.push({
          x:
            mt * mt * mt * start.x +
            3 * mt * mt * t * control1.x +
            3 * mt * t * t * control2.x +
            t * t * t * end.x,
          y:
            mt * mt * mt * start.y +
            3 * mt * mt * t * control1.y +
            3 * mt * t * t * control2.y +
            t * t * t * end.y
        });
      }

      return points;
    },

    stitchPaths(paths) {
      const output = [];
      paths.forEach((path) => {
        path.forEach((point, index) => {
          if (output.length > 0 && index === 0 && this.distance(output[output.length - 1], point) < 1e-6) {
            return;
          }
          output.push({ x: point.x, y: point.y });
        });
      });
      return output;
    }
  };

  NS.GeometryUtils = GeometryUtils;
})(window.ParkingSim);
