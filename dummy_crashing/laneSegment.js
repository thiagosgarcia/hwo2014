function LaneSegment(lane) {
    this.lane = lane;

    this.distanceToNextSwitch = 0.0;
    this.nextSegments = [];
}

module.exports = LaneSegment;