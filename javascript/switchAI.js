var LaneSegment = require('./laneSegment.js');

function SwitchAI(driver) {
    this.car = driver.car;

    declarePrivateMethods.call(this);
}

SwitchAI.prototype.determineSwitchDirection = function() {
    var car = this.car;
    var nextSwitchPiece = car.nextSwitchPiece;
    if(nextSwitchPiece == null) return;

    var lanes = car.track.lanes;
    var switchesAheadToCheck = lanes.length - 1;
    var switchesAhead = this.getSwitchesAhead(nextSwitchPiece, switchesAheadToCheck);

    var segmentsToCheck = this.getSegmentsToCheck(car.track, car.lane, switchesAhead);
    var bestLaneToSwitch = this.getBestLaneToSwitch(segmentsToCheck);
    car.lastLane = car.lane;
    car.nextLane = bestLaneToSwitch;

    var switchDirection = this.getSwitchDirection(car.lane, bestLaneToSwitch);
    return switchDirection;
};

function declarePrivateMethods() {

    // ***** Switch intelligence (private methods) ***** //

    this.getSwitchesAhead = function(nextSwitchPiece, switchesAheadToCheck) {
        var switchesAhead = [nextSwitchPiece];
        var nextPiece = nextSwitchPiece;

        while(switchesAheadToCheck > 0) {
            nextPiece = nextPiece.nextPiece;

            if(nextPiece.hasSwitch) {
                switchesAhead.push(nextPiece);
                switchesAheadToCheck--;
            }
        }

        switchesAhead.reverse();
        return switchesAhead;
    };

    this.getSegmentsToCheck = function(track, lane, switchesAhead) {
        var segmentsToCheck = [new LaneSegment(lane)];
        var laneToTheLeft = track.lanes[lane.index - 1];
        var laneToTheRight = track.lanes[lane.index + 1];

        if(!!laneToTheLeft)
            segmentsToCheck.push(new LaneSegment(laneToTheLeft));

        if(!!laneToTheRight)
            segmentsToCheck.push(new LaneSegment(laneToTheRight));

        var switchFrom = switchesAhead.pop();
        if(switchesAhead.length <= 0) return [];

        for(var i = 0; i < segmentsToCheck.length; i++) {
            var segmentToCheck = segmentsToCheck[i];

            segmentToCheck.distanceToNextSwitch = switchFrom.distanceToNextSwitch(lane, segmentToCheck.lane);
            segmentToCheck.nextSegments = this.getSegmentsToCheck(track,
                segmentToCheck.lane,
                switchesAhead);
        }

        return segmentsToCheck;
    };

    this.getBestLaneToSwitch = function(segmentsToCheck) {
        var bestLane = null;

        for(var i = 0; i < segmentsToCheck.length; i++) {
            var segmentToCheck = segmentsToCheck[i];
            var laneToCheck = segmentToCheck.lane;

            laneToCheck.bestDistance = segmentToCheck.distanceToNextSwitch;
            laneToCheck.bestDistance += this.getBestDistanceToSwitch(segmentToCheck.nextSegments);

            if(bestLane == null || bestLane.bestDistance > laneToCheck.bestDistance)
                bestLane = laneToCheck;
        }

        return bestLane;
    };

    this.getBestDistanceToSwitch = function(segmentsToCheck) {
        var segmentDistances = [];

        for(var i = 0; i < segmentsToCheck; i++) {
            var segmentToCheck = segmentsToCheck[i];
            var segmentDistance = segmentToCheck.distanceToNextSwitch;

            segmentDistance += this.getBestDistanceToSwitch(segmentToCheck.nextSegments);
            segmentDistances.push(segmentDistance);
        }

        if(segmentDistances.length <= 0)
            return 0;

        return Math.min.apply(null, segmentDistances);
    };

    this.getSwitchDirection = function(currentLane, bestLane) {
        // The best lane is more to the left of the center, switch Left.
        if(currentLane.distanceFromCenter > bestLane.distanceFromCenter) {
            return 'Left';
        }

        // The best lane is more to the right of the center, switch Right.
        else if(currentLane.distanceFromCenter < bestLane.distanceFromCenter) {
            return 'Right';
        }

        // The lane the car is driving is already the best! Nothing to do here..
        return null;
    }
}

module.exports = SwitchAI;