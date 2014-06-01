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

    // Breaking-learn function
    this.ticksBreakingInStraight = 0;
    this.breakingFactors = [];
    this.speedAccelerationFactor = 49;

    this.switchAI = new SwitchAI(this);
    this.turboAI = new TurboAI(this);

    declarePrivateMethods.call(this);
}

// ***** Throttle intelligence ***** //

Driver.prototype.drive = function() {
    Logger.log("carAngle: " + this.car.angle);
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

    var angleAbs = Math.abs(car.angle);
    var lastAngleAbs = Math.abs(car.lastAngle);

    if(angleAbs < lastAngleAbs)
        return 1.0;

    if(this.shouldBreakInBend() || this.shouldBreakForTargetSpeed())
        return 0.0;

    if(willCrash(car, 60))
        return 0.0;

    // TODO: deve ser refatorado usando a aceleração angular ao inves de 4.0
    var angleDiff = angleAbs - lastAngleAbs;
    if (angleDiff > 4.0)
        return 0.0;

    return 1.0;
};

// ***** Direction calculations **** //
// TODO: me explicar isso
function calculateLaneDistanceFromCenter(car, piece){

    const lane = car.lane;
    const lanes = car.track.lanes;
    const nextSwitchPiece = car.nextSwitchPiece;
    const switchDirection = car.driver.determineSwitchDirection();

    var laneDistanceFromCenter = 0.0;
    if(piece.index < nextSwitchPiece.index){
        // If next bend is before the switch, next bend calc is for the actual lane
        laneDistanceFromCenter = piece.laneDistanceFromCenter(lane);
    }else{
        // If next bend is the next switch or the next switch is before the next bend we must calc
        // the speed for the lane that the car will be
        laneDistanceFromCenter  = switchDirection == null ? piece.laneDistanceFromCenter(lane)
            : switchDirection == 'Right' ?  piece.laneDistanceFromCenter(lanes[lane.index + 1])
            : piece.laneDistanceFromCenter(lanes[lane.index - 1]);
    }

    return laneDistanceFromCenter;
}

// ***** Breaking calculations ***** //

//#added
function ticksToSpeed(currentSpeed, targetSpeed, frictionFactor){
    var speedDiff = currentSpeed - targetSpeed;
    if(speedDiff <= 0)
        return Infinity;

    var currentBreakAcceleration = currentSpeed / frictionFactor;
    var targetBreakAcceleration = targetSpeed / frictionFactor;
    var breakAccelerationAverage = ((currentBreakAcceleration + targetBreakAcceleration) / 2);
    var ticksLeftToTargetSpeed = speedDiff / breakAccelerationAverage;
    return ticksLeftToTargetSpeed - 5;
}
//#added
function ticksToAngle(car, piece, targetAngle){

    var currentAngle = car.angle;
    if(piece.angle < 0 && targetAngle > 0)
        targetAngle *= -1;
    else if(piece.angle > 0 && targetAngle < 0)
        targetAngle *= -1;

    return Math.abs((targetAngle - currentAngle) / car.angleSpeed )


    /*
    var currentAngle = car.angle;
    var angleDiff = Math.abs(targetAngle - currentAngle);
    var securityFactor = 1;

    // current angle must be between target angle and its inverse
    if(Math.abs(targetAngle) < Math.abs(currentAngle))
        return Infinity;

    var angleAcceleration = car.angleAcceleration;
    var angleAccelerationFactor = car.angleAccelerationFactor;

    var ticksToTargetAngle = Math.abs(car.angle - car.lastAngle) / car.angleSpeed ;
    return ticksToTargetAngle - securityFactor;
    */
}

function willCrash(car, maxAngle){
    var angleAbs = Math.abs(car.angle);

    var ticksToNextBend = car.distanceToBend() / car.lastSpeed;
    var ticksToAngleSixty = Math.abs(maxAngle - angleAbs) / car.angleSpeed;

    // Fator que aumenta o numero de ticks necessarios para o carro chegar ao angulo 60. Utilizado para evitar
    // que o carro chegue ao angulo 60 e derrape.
    // TODO: Alterar essa variavel para uma constante de Driver;
    var securityFactor = 4;

    var angleIsIncreasing = ( car.angleSpeed > 0 && car.angle > 0 ) ||
                            ( car.angleSpeed < 0 && car.angle < 0 );

    if(checkSlip(ticksToNextBend,
                 securityFactor,
                 angleIsIncreasing,
                 ticksToAngleSixty))
        return true;

    return false;

    //temporariamente desabilitado, vou refatorar
    var bendPieceAhead = car.bendsAhead[1];
    var angleDiff = 0;
    if( bendPieceAhead.angle > 0)
        angleDiff = Math.abs(maxAngle - car.angle);
    else
        angleDiff = Math.abs((maxAngle * -1) - car.angle);

    var ticksToAngleSixtyOfBendAhead = angleDiff / car.angleSpeed;

    // Prevent ricochet (rebound)
    angleIsIncreasing = ( bendPieceAhead.angle > 0 && car.angleSpeed > 0 ) ||
                        ( bendPieceAhead.angle < 0 && car.angleSpeed < 0 );

    return checkSlip(car.distanceToPiece(car.bendsAhead[1]),
                     securityFactor,
                     angleIsIncreasing,
                     ticksToAngleSixtyOfBendAhead);

}

function checkSlip(ticksToNextBend, securityFactor, angleIsIncreasing, ticksToAngleSixty, log) {
    if((ticksToNextBend + securityFactor > ticksToAngleSixty) &&
        angleIsIncreasing) {
        Logger.log("ticksToNextBend "+ ticksToNextBend + " ticksToAngleSixty " + ticksToAngleSixty);
        return true;
    }
    return false;
}

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
                Math.abs(this.car.angle) <= 6);
    };

    this.calculateBreakingFactor = function() {
        var currentAcc = this.car.acceleration;
        var currentSpeed = this.car.lastSpeed;
        var currentBreakingFactor = Math.abs(currentSpeed / currentAcc);

        this.breakingFactors.push(currentBreakingFactor);
        this.breakingFactors.sort(function(a,b){return a-b});

        if(this.breakingFactors.length > 3) {
            this.breakingFactor = this.getBreakingFactorsMedian();
            Logger.log(" New breaking factor: " + this.breakingFactor);
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

        if(car.currentSpeed < targetSpeed)
            return false;

        return this.isTimeToBreakForTargetSpeed(targetSpeed);
    };

    this.isTimeToBreakForTargetSpeed = function(targetSpeed) {
        var currentSpeed = this.car.currentSpeed;
        var speedDiff = currentSpeed - targetSpeed;

        // Calculate the breaking acceleration if the car fully breaks with current speed
        var currentBreakAcceleration = currentSpeed / this.breakingFactor;

        // Calculate the breaking acceleration in target speed
        var targetBreakAcceleration = targetSpeed / this.breakingFactor;

        // Calculate the average of both breaking accelerations
        var breakAccelerationAverage = ((currentBreakAcceleration + targetBreakAcceleration) / 2.0);

        // Calculate the ticks left to the car get into speedTarget
        var ticksLeftToTargetSpeed = Math.ceil(speedDiff / breakAccelerationAverage);

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

        var pieceLength = piece.lengthInLane(car.lane);
        var inPiecePosition = car.inPieceDistance;
        var angleInRadians = car.angleInRadians;
        var inPieceRadianPosition = angleInRadians * inPiecePosition / pieceLength;
        var inPieceLastRadianPosition = angleInRadians * car.inPieceDistance - car.acceleration / pieceLength;

        var radianPerTick = inPieceRadianPosition - inPieceLastRadianPosition;
        var radiusInLane = piece.radius + calculateLaneDistanceFromCenter(car, piece);
        var centripetSpeed = Math.pow(radianPerTick, 2) * radiusInLane;

        var frictionFactor = this.breakingFactor;

        var perfectSpeed = Math.sqrt(radiusInLane / this.breakingFactor * 9.78);
        //var ticksToTargetAngle = ticksToAngle(car, maxAngle);
        var ticksToTargetAngle = ticksToAngle(car, piece, maxAngle);
        var ticksToTargetSpeed = ticksToSpeed(car.currentSpeed, perfectSpeed , frictionFactor );

        Logger.log(" ticksToTargAngle: " + ticksToTargetAngle
            + " | ticksToTargSpeed: " + ticksToTargetSpeed
            + " | angleSpeed: " + car.angleSpeed
            + " | angleAcc: " + car.angleAcceleration
            + " | angleAccFactor: " + car.angleAccelerationFactor
            + " | " + perfectSpeed );

        return (car.currentSpeed > perfectSpeed || ticksToTargetAngle <= ticksToTargetSpeed);
/*
        if(car.currentSpeed <= perfectSpeed)
            return false;
        if(car.angleSpeed < 0)
            return false;
        if(ticksToTargetAngle > ticksToTargetSpeed)
            return false;
        return true;
*/
    };

    // ***** Utility methods ***** //

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
