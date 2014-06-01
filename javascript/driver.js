var Logger = require("./logger.js");
require('./array.median.js');
var SwitchAI = require('./switchAI.js');
var TurboAI = require('./turboAI.js');

const ANGLE_TO_CRASH = 60.0;

function Driver(car) {
    this.car = car;
    this.checkSwitch = true;

    // Empyrical result;
    this.breakingFactor = 49.0;

    // Break learning variables
    this.ticksBreakingInStraight = 0;
    this.breakingFactors = [];
    this.speedAccelerationFactor = 49;

    this.switchAI = new SwitchAI(this);
    this.turboAI = new TurboAI(this);

    declarePrivateMethods.call(this);
}

// ***** Throttle intelligence ***** //

Driver.prototype.drive = function() {
    var currentPiece = this.car.currentPiece;

    if (currentPiece.type == "S") {
        return this.driveForStraight();

    } else if (currentPiece.type == "B") {
        return this.driveForBend();
    }

    return 1.0;
};

Driver.prototype.driveForStraight = function() {
    if(!this.shouldBreakForTargetSpeed()) {
        this.ticksBreakingInStraight = 0;
        return 1.0;
    }

    this.ticksBreakingInStraight++;
    if(this.isTimeToCalculateTheBreakingFactor())
        this.calculateBreakingFactor();

    return 0.0;
};

Driver.prototype.driveForBend = function() {
    var car = this.car;
    this.ticksBreakingInStraight = 0;
    if(car.angleSpeed < 0.0)
        return 1.0;

    if(this.shouldBreakInBend() || this.shouldBreakForTargetSpeed())
        return 0.0;

    return 1.0;
};

// ***** Turbo intelligence ***** //

Driver.prototype.canTurbo = function() {
    return this.turboAI.determineTurboUse();
};

// ***** Switch intelligence ***** //

Driver.prototype.determineSwitchDirection = function() {
    return this.switchAI.determineSwitchDirection();
};

function declarePrivateMethods() {

    // ***** Breaking Factor calculations ***** //

    this.isTimeToCalculateTheBreakingFactor = function() {
        // If the car started breaking less than 3 ticks ago, the breaking speed is still not ok for the calculation;
        // If the angle is too high, it must not calculate;
        return (this.car.acceleration < 0.0 &&
                this.ticksBreakingInStraight > 3 &&
                Math.abs(this.car.angle) <= 6.0);
    };

    this.calculateBreakingFactor = function() {
        var currentAcc = this.car.acceleration;
        var currentSpeed = this.car.lastSpeed;
        var currentBreakingFactor = Math.abs(currentSpeed / currentAcc);

        this.breakingFactors.push(currentBreakingFactor);
        this.breakingFactors.sort(function(a,b){return a-b});

        if(this.breakingFactors.length > 3) {
            this.breakingFactor = this.getBreakingFactorsMedian();
            Logger.setBreakingFactor(this.breakingFactor);
        }
    };

    this.getBreakingFactorsMedian = function() {
        this.removeExcessBreakingFactors();
        return this.breakingFactors.median();
    };

    this.removeExcessBreakingFactors = function() {
        // Eliminate the pre-calculated breaking factors in the array extremes, if it gets too big.
        if(this.breakingFactors.length > 21) {
            this.breakingFactors.shift();
            this.breakingFactors.pop();
        }

        var median = this.breakingFactors.median();
        var indexesToRemove = [];

        // Remove the breaking factors that are 2.5% higher or lower than the array median.
        for(var i = 0; i < this.breakingFactors.length; i++) {
            var breakingFactor = this.breakingFactors[i];

            if(breakingFactor > median * 1.025 || breakingFactor < median * 0.975) {
                indexesToRemove.push(i);
            }
        }

        for(i = 0; i < indexesToRemove.length; i++) {
            var indexToRemove = indexesToRemove[i];

            this.breakingFactors.splice(indexToRemove, 1);
        }
    };

    // ***** Breaking intelligence ***** //

    this.shouldBreakForTargetSpeed = function() {
        if(this.car.inLastStraight())
            return false;

        var car = this.car;
        var nextBendPiece = car.bendsAhead[0];
        var targetSpeed = nextBendPiece.targetSpeed(car.laneInNextBend(), this.breakingFactor);
        Logger.setTargetSpeed(targetSpeed);

        if(car.currentSpeed < targetSpeed)
            return false;

        return this.isTimeToBreakForTargetSpeed(targetSpeed);
    };

    this.isTimeToBreakForTargetSpeed = function(targetSpeed) {
        var currentSpeed = this.car.currentSpeed;
        var breakAccelerationAverage = this.breakingAccelerationAverageToTargetSpeed(targetSpeed);

        // Calculate the ticks left to the car get into speedTarget
        var ticksLeftToTargetSpeed = this.ticksToBreakUntilTargetSpeed(targetSpeed);

        // Calculate the ticks left to entering the next bend
        var distanceToBend = this.car.distanceToBend();
        var ticksLeftToBendOnCurrentSpeed = this.getTicksToTravelDistance(distanceToBend,
                                                                          currentSpeed,
                                                                          breakAccelerationAverage);

        // If the car needs more ticks to break than the ticks left to achieve the target speed,
        // then it is time to break, otherwise, step on it!
        return (ticksLeftToBendOnCurrentSpeed < ticksLeftToTargetSpeed);
    };

    this.shouldBreakInBend = function() {

        var car = this.car;
        var piece = this.car.currentPiece;
/*
        var pieceLength = piece.lengthInLane(car.lane);
        var inPiecePosition = car.inPieceDistance;
        var angleInRadians = car.angleInRadians;
        var inPieceRadianPosition = angleInRadians * inPiecePosition / pieceLength;
        var inPieceLastRadianPosition = angleInRadians * car.inPieceDistance - car.acceleration / pieceLength;

        var radianPerTick = inPieceRadianPosition - inPieceLastRadianPosition;
        var centripetSpeed = Math.pow(radianPerTick, 2) * radiusInLane;
*/

        var radiusInLane = piece.radiusInLane(car.nextLane);
        var maintenanceSpeed = Math.sqrt(radiusInLane / this.breakingFactor * 9.78);

        if(car.currentSpeed <= maintenanceSpeed)
            return false;

        var ticksToCrash = this.ticksToCarAngle(ANGLE_TO_CRASH);
        var ticksToMaintenanceSpeed = this.ticksToBreakUntilTargetSpeed(maintenanceSpeed);

        Logger.log(" ticksToTargAngle: " + ticksToCrash
            + " | ticksToTargSpeed: " + ticksToMaintenanceSpeed
            + " | angleSpeed: " + car.angleSpeed
            + " | angleAcc: " + car.angleAcceleration
            + " | angleAccFactor: " + car.angleAccelerationFactor
            + " | " + maintenanceSpeed );

        return ticksToCrash < ticksToMaintenanceSpeed;
    };

    // ***** Utility methods ***** //

    this.breakingAccelerationAverageToTargetSpeed = function(targetSpeed) {
        var currentSpeed = this.car.currentSpeed;
        if(currentSpeed < targetSpeed)
            return 0.0;

        // Calculate the breaking acceleration if the car fully breaks with current speed
        var currentBreakAcceleration = currentSpeed / this.breakingFactor;

        // Calculate the breaking acceleration for target speed
        var targetBreakAcceleration = targetSpeed / this.breakingFactor;

        // Calculate the average of both breaking accelerations
        return ((currentBreakAcceleration + targetBreakAcceleration) / 2.0);
    };

    this.ticksToBreakUntilTargetSpeed = function(targetSpeed) {
        var currentSpeed = this.car.currentSpeed;
        var speedDiff = currentSpeed - targetSpeed;
        if(speedDiff <= 0)
            return Infinity;

        var breakAccelerationAverage = this.breakingAccelerationAverageToTargetSpeed(targetSpeed);
        return Math.ceil(speedDiff / breakAccelerationAverage);
    };

    this.ticksToCarAngle = function(targetAngle) {
        if(this.car.angleSpeed <= 0)
            return Infinity;

        var currentPiece = this.car.currentPiece;

        // Adjust the target angle to match the piece direction.
        if((currentPiece.angle < 0 && targetAngle > 0) ||
            (currentPiece.angle > 0 && targetAngle < 0))
            targetAngle *= -1;

        var ticks = 0;
        var angleDelta = Math.abs(targetAngle - this.car.angle);
        var angleSpeed = this.car.angleSpeed;
        var angleAcc = this.car.angleAcceleration;

        while(angleDelta > 0.0) {
            angleDelta -= angleSpeed + (angleAcc * ticks);
            ticks++;
        }

        return ticks;
    };

    this.getTicksToTravelDistance = function(distance, speed, acceleration) {
        var ticks = 0;
        while(distance > 0.0) {
            distance -= speed + (acceleration * ticks);
            ticks++;
        }

        return ticks;
    };
}

module.exports = Driver;
