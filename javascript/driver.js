require('./array.median.js');
require('./constants.js');

var Logger = require("./logger.js");
var Piece = require('./piece.js');
var SwitchAI = require('./switchAI.js');
var TurboAI = require('./turboAI.js');

function Driver(car) {
    this.car = car;
    this.checkSwitch = true;

    // Empyrical result;
    this.breakingFactor = 49.0;
    Logger.setBreakingFactor(this.breakingFactor);

    // Break learning variables
    this.ticksBreakingInStraight = 0;
    this.breakingFactors = [];
    this.speedAccelerationFactor = 49;

    this.switchAI = new SwitchAI(this);
    this.turboAI = new TurboAI(this);

    declarePrivateMethods.call(this);
}
/*
Driver.prototype.setCrashAngle = function(angle){
    angle = Math.abs(angle);
    var crashAngleDifference = this.angleToCrash - angle;
    if( crashAngleDifference < 0 )
        return;

    crashAngleDifference *= 2;
    if( crashAngleDifference > 6)
        crashAngleDifference = 6;
    this.angleToCrash -= crashAngleDifference;
    Logger.setCrashAngle(this.angleToCrash);
    this.incrementCrashCounter.call(this);
};*/
/*
Driver.prototype.incrementCrashCounter = function(){
    var car = this.car;
    var crashPiece = car.currentPiece;
    if(car.currentPiece.type == "S"){
        if(car.currentPiece.previousPiece == "S")
            return;
        crashPiece = car.currentPiece.previousPiece;
    }
    crashPiece.timesCrashedInBend ++;
    var pieceToVerify = crashPiece.nextPiece;
    while (pieceToVerify.index != crashPiece.index){
        if(crashPiece.bendIndex == pieceToVerify.bendIndex)
            pieceToVerify.timesCrashedInBend ++;
        pieceToVerify = pieceToVerify.nextPiece;
    }
};*/

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
    this.ticksBreakingInStraight++;
    if(this.isTimeToCalculateTheBreakingFactor())
        this.calculateBreakingFactor();

    return 0.0;
};

Driver.prototype.driveForBend = function() {
    var car = this.car;
    this.ticksBreakingInStraight = 0;
    if(car.angleSpeed <= 0.0)
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
        var nextBendPiece = car.currentPiece.firstPieceInBendAhead();
        var targetSpeed = this.getSecureTargetSpeedForBendAhead(nextBendPiece);
        Logger.setTargetSpeed(targetSpeed);

        if(car.currentSpeed < targetSpeed)
            return false;

        return this.isTimeToBreakForTargetSpeed(targetSpeed);
    };

    this.getSecureTargetSpeedForBendAhead = function(nextBendPiece) {
        var secondBendAhead = nextBendPiece.firstPieceInBendAhead();

        var targetSpeed = nextBendPiece.targetSpeed(this.car.laneInNextBend(), this.breakingFactor);
        var targetSpeedForSecondBendAhead = secondBendAhead.targetSpeed(this.car.laneInNextBend(), this.breakingFactor);
        if(targetSpeed <= targetSpeedForSecondBendAhead)
            return targetSpeed;

        var divisionCounter = 1;
        while(this.canBreakFromSpeedToNextBendTargetSpeed(nextBendPiece, targetSpeed, targetSpeedForSecondBendAhead, 0.0)
                || divisionCounter > 1000) {
            targetSpeed -= ((targetSpeed - targetSpeedForSecondBendAhead) / (divisionCounter * 2.0));
            divisionCounter++;
        }

        return targetSpeed;
    };

    this.isTimeToBreakForTargetSpeed = function(targetSpeed) {
        var currentSpeed = this.car.currentSpeed;
        var currentPiece = this.car.currentPiece;

        return this.canBreakFromSpeedToNextBendTargetSpeed(currentPiece, currentSpeed, targetSpeed, this.car.inPieceDistance);
    };

    this.canBreakFromSpeedToNextBendTargetSpeed = function(piece, speed, targetSpeed, carOffset) {
        var ticksLeftToTargetSpeed = this.ticksToBreakToTargetSpeed(speed, targetSpeed);

        var distanceToBend = Piece.distanceFromPieceToPiece(piece, piece.firstPieceInBendAhead(), this.car.lane);
        distanceToBend -= carOffset;
        var breakAccelerationAverage = this.breakingAccelerationAverageToTargetSpeed(speed, targetSpeed);
        var ticksLeftToBendOnCurrentSpeed = this.getTicksToTravelDistance(distanceToBend, speed, breakAccelerationAverage);

        return (ticksLeftToBendOnCurrentSpeed < ticksLeftToTargetSpeed);
    };

    this.shouldBreakInBend = function() {

        var car = this.car;
        var piece = car.currentPiece;
        var maintenanceSpeed = piece.maintenanceSpeed(car.nextLane, this.breakingFactor);
        Logger.setMaintenanceSpeed(maintenanceSpeed);

        if(car.currentSpeed <= maintenanceSpeed)
            return false;

        if(piece.isInChicane)
            maintenanceSpeed = piece.targetSpeed(this.car.lane, this.breakingFactor, piece.timesCrashedInBend);
            //maintenanceSpeed *= 1.12;

        var ticksToCrash = this.ticksToCarAngle(piece.angleToCrash);
        var ticksToMaintenanceSpeed = this.ticksToBreakToTargetSpeed(this.car.currentSpeed, maintenanceSpeed);

        Logger.log(" ticksToTargAngle: " + ticksToCrash
            + " | ticksToTargSpeed: " + ticksToMaintenanceSpeed
            + " | angleSpeed: " + car.angleSpeed
            + " | angleAcc: " + car.angleAcceleration
            + " | angleAccFactor: " + car.angleAccelerationFactor
            + " | " + maintenanceSpeed );

        return ticksToCrash < ticksToMaintenanceSpeed;
    };

    // ***** Utility methods ***** //

    this.breakingAccelerationAverageToTargetSpeed = function(speed, targetSpeed) {
        if(speed < targetSpeed)
            return 0.0;

        // Calculate the breaking acceleration if the car fully breaks with current speed
        var currentBreakAcceleration = speed / this.breakingFactor;

        // Calculate the breaking acceleration for target speed
        var targetBreakAcceleration = targetSpeed / this.breakingFactor;

        // Calculate the average of both breaking accelerations
        return ((currentBreakAcceleration + targetBreakAcceleration) / 2.0);
    };

    this.ticksToBreakToTargetSpeed = function(speed, targetSpeed) {
        var speedDiff = speed - targetSpeed;
        if(speedDiff <= 0)
            return Infinity;

        var breakAccelerationAverage = this.breakingAccelerationAverageToTargetSpeed(speed, targetSpeed);
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

        // infinite loop bug [2]
        while(angleDelta > 0.0 || ticks > 1000) {
            angleDelta -= angleSpeed + (angleAcc * ticks);
            ticks++;
        }

        return ticks;
    };

    this.getTicksToTravelDistance = function(distance, speed, acceleration) {
        var ticks = 0;

        // infinite loop bug [2]
        if(speed <= 0)
            return ticks;

        while(distance > 0.0 || ticks > 1000) {
            distance -= speed + (acceleration * ticks);
            ticks++;
        }

        return ticks;
    };
}

module.exports = Driver;
