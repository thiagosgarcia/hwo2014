var Piece = require('./piece.js');
var SwitchAI = require('./switchAI.js');

function Driver(car) {
	this.car = car;
	this.checkSwitch = true;

	this.bendFactor = 67500.0;
    this.breakingFactor = 49.0;

    // Breaking-learn function
    this.ticksBreaking = 0;
    this.lastBreakingFactors = [];
    this.speedAccelerationFactor = 49;

    this.switchAI = new SwitchAI(this);

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

    return 1;
};

// ***** Speed calculations ***** //

Driver.prototype.driveForStraight = function() {
    console.log(" carAngle: " + this.car.angle);

    if ( !this.shouldBreak() ) {
        this.ticksBreaking = 0;
        return 1.0;
    }

    this.calculateBreakingFactor();
    return 0.0;
};

Driver.prototype.driveForBend = function() {
    var car = this.car;
    console.log(" carAngle: " + car.angle);

    this.ticksBreaking = 0;

    var angleAbs = Math.abs(car.angle);
    var lastAngleAbs = Math.abs(car.lastAngle);

    if(this.shouldBreakInBend() || this.shouldBreak())
        return 0.0;

    if(willCrash(car, 60))
        return 0.0;

    if(angleAbs < lastAngleAbs)
        return 1;

    var angleDiff = angleAbs - lastAngleAbs;
    if (angleDiff > 4.0)
        return 0.0;

    return 1.0;
};

function averageOfNumberArray(numberArray, defaultValue){
    if(numberArray.length == 0)
        return defaultValue;

    var i = -1;
    var sum = 0.0;
    while (++ i < numberArray.length){
        sum += numberArray[i];
    }
    return sum / numberArray.length;
}

Driver.prototype.calculateBreakingFactor = function(){
    // This will calculate the friction factor and...
    // IMPORTANT! This function can only be called in a straight and when the car is breaking

    // only in negative acceleration
    if(this.car.acceleration > 0)
        return;

    // This is for breaking-learn functions
    this.ticksBreaking ++;
    console.log(" TicksBreaking " + this.lastBreakingFactors.length)
    console.log(" Factors " + this.lastBreakingFactors);
    // If less, the breaking speed is not ok for the calculation
    if(this.ticksBreaking <= 3)
        return;

    // If the angle is too high, it must not calculate
    if(this.car.angle > 6 || this.car.angle < -6)
        return;

    // To stay this array smaller, don't need too much data and take out the biggest and the lower
    if(this.lastBreakingFactors.length > 21){
        this.lastBreakingFactors.shift();
        this.lastBreakingFactors.pop();
    }

    var car = this.car;
    var speed = this.car.lastSpeed;
    var acceleration = this.car.acceleration;

    this.lastBreakingFactors.push(Math.abs(speed / acceleration));

    if(this.lastBreakingFactors.length > 3){
        this.breakingFactor = averageOfNumberArray(this.lastBreakingFactors, this.breakingFactor);
        console.log(" New friction factor: " + this.breakingFactor);

        // To stay this array clean, remove some elements out of the average.
        // This is MOD 10, because I don't want to to this all the time. maybe 2 or 3 items are making this get
        // out of the average
        if(this.lastBreakingFactors.length % 5 != 0)
            return;

        // the most probably cause of a uncommon values are the lasts added ;)
        this.lastBreakingFactors.sort(function(a,b){return a-b});
        console.log(this.lastBreakingFactors);

        //Math.floor for now, but we got to know if we use the upper or lower median
        var med = this.lastBreakingFactors[Math.floor(this.lastBreakingFactors.length / 2)]

        var i = -1;
        while( ++ i < this.lastBreakingFactors.length ){

            // Ajustar a variância pra 5%
            if(this.lastBreakingFactors[i] > med * 1.025
                || this.lastBreakingFactors[i] < med * 0.975){
                console.log(" Factor removed: " + this.lastBreakingFactors[i] + " Average: " + this.breakingFactor);
                this.lastBreakingFactors.splice(i, 1);
                // If something is removed, new average is set, otherwise, it'll return the same value
                this.breakingFactor = averageOfNumberArray(this.lastBreakingFactors, this.breakingFactor);
            }
        }

    }
    // Adjust factor
    this.breakingFactor;


}

// ***** Direction calculations **** //
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
Driver.prototype.shouldBreakInBend = function() {

    var car = this.car;
    var piece = this.car.currentPiece;
    var maxAngle = 60;

    if(piece.type == "S")
        return null;

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
    var ticksToTargetSpeed = ticksToSpeed(car.currentSpeed, perfectSpeed , frictionFactor )

    console.log(" ticksToTargAngle: " + ticksToTargetAngle
        + " | ticksToTargSpeed: " + ticksToTargetSpeed
        + " | angleSpeed: " + car.angleSpeed
        + " | angleAcc: " + car.angleAcceleration
        + " | angleAccFactor: " + car.angleAccelerationFactor
        + " | " + perfectSpeed );

    var securityMaxAngleTicksFactor = 3;
    if(car.currentSpeed <= perfectSpeed)
        return false;
    if(car.angleSpeed < 0)
        return false;
    if(ticksToTargetAngle > ticksToTargetSpeed)
        return false;
    return true;

};
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

Driver.prototype.shouldBreak = function(){
    var car = this.car;
    var currentSpeed = car.currentSpeed;

    var distanceToBend = car.distanceToBend();
    var distanceToBendAhead = car.distanceToPiece(car.bendsAhead[1]);

    var nextBendPiece = car.bendsAhead[0];
    var nextNextBendPiece = car.bendsAhead[1];

    // Target speed to entering bends. It'll be calculated using bend radius and size
    //I can't pass simply the next lane. It is gotta be the next lane only if there's
    // a switch before it. Otherwise I'll pass the current lane
    var targetSpeed = nextBendPiece.targetSpeed(car.laneInNextBend(), this.breakingFactor);
    var targetSpeedForBendAhead = nextNextBendPiece.targetSpeed(car.laneInNextBend(), this.breakingFactor);

    if(car.inLastStraight())
        return false;

    // Verify if it is time to break for the bend 2x ahead
    //if(isTimeToBreak(currentSpeed, distanceToBend2TimesAhead, targetSpeedForBend2TimesAhead, this.breakingFactor)){
    //    console.log(" breaking for bend 2x ahead... ")
    //    return true;
    //}
    // Verify if it is time to break for the bend ahead
    if(isTimeToBreak(currentSpeed, distanceToBendAhead, targetSpeedForBendAhead, this.breakingFactor)){
        console.log(" breaking for bend ahead... ");
        return true;
    }
    // If it is in a bend, only verify the bend ahead speed. Logic for bend speed is in speed in bend function
    //if(car.currentPiece.type == "B")
    //    return false;

    // Verify if it is time to break for the next bend
    return isTimeToBreak(currentSpeed, distanceToBend, targetSpeed, this.breakingFactor);
};

function isTimeToBreak(currentSpeed, distanceToBend, targetSpeed, frictionFactor){

    // FrictionFactor is the relation between speed and negative acceleration when the car is
    // fully breaking in a Straight piece.
    // It'll be calculated for each race when breaking in the firsts bends because of the
    // possibility to have a value for each track
    //var breakingFactor = 49;

    // Now with the target speed adjusted, I don't see this use, but I'll let it here for now
    // This is a delay for breaking. Less, the pilot breaks earlier, more the pilot breaks later.
    // 4 - 5 value makes the pilot break pretty securely and close to the bend.
    // Smaller values may be used when the car is in the inner lane, greater when it is in the outer lane
    // carefully, of course
    var breakingTicksDelay = -3 ;

    // Now with the target speed adjusted, I don't see this use, but I'll let it here for now
    // lower speeds needs less breaking tick delay
    //if(targetSpeed < 5)
    //    breakingTicksDelay--;

    var speedDiff = currentSpeed - targetSpeed;
    // If the speed is less than target speed there's no need to break
    if(speedDiff <= 0)
        return false;

    // Calculate the breaking acceleration if the car fully breaks with current speed
    var currentBreakAcceleration = currentSpeed / frictionFactor;
    // Calculate the breaking acceleration in target speed
    var targetBreakAcceleration = targetSpeed / frictionFactor;
    // Calculate the average of both breaking accelerations measured upper
    var breakAccelerationAverage = ((currentBreakAcceleration + targetBreakAcceleration) / 2);
    // Calculate the ticks left to the car get into speedTarget
    var ticksLeftToTargetSpeed = speedDiff / breakAccelerationAverage;
    var ticksLeftToBendOnCurrentSpeed = distanceToBend / currentSpeed;

    //If the car needs more ticks to break than the ticks left to achieve the target speed,
    // then it is time to break, otherwise, step on it!
    if( ticksLeftToBendOnCurrentSpeed + breakingTicksDelay < ticksLeftToTargetSpeed ){
        //console.log("ticksLeftToBendOnCurrentSpeed: " + ticksLeftToBendOnCurrentSpeed +
        //    " ticksLeftToTargetSpeed: " + ticksLeftToTargetSpeed)
        return true;
    }

    return false;
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
        console.log("ticksToNextBend "+ ticksToNextBend + " ticksToAngleSixty " + ticksToAngleSixty);
        return true;
    }
    return false;
}

// ***** Turbo intelligence ***** //

// Determine, by the car position in the track, if this tick is the right moment
// to use the active turbo;
Driver.prototype.canTurbo = function() {

    var car = this.car;
    var currentPiece = car.currentPiece;
    var currentAcc = this.car.acceleration;

    // If the car is breaking (acc <= 0.0), the turbo will not be optmized
    if(currentAcc <= 0.0)
        return false;

    // Check if the car angle is low enough to be safe to use the turbo
    // -> The angle for turbo may must be lower, but the condition ahead should be enough. This is an alert point
    if(car.angle > 10.0 || car.angle < -10.0)
        return false;

    // If the currentPiece the car is on is a Bend, we have to check if the car is on its exit;
    if(currentPiece.type == "B") {
        // Check if the car is on the last half of the Bend;
        // -> It was not working harder bends, let's do this in the last quarter for now
        var bendLength = currentPiece.bendLength(false, car.lane);
        if(Piece.distanceFromPieceToPiece(car.straightPieceBefore, currentPiece)
                < (bendLength * 0.75))
            return false;
    }

    var distanceToBend = car.distanceToBend();
    // The distance the car will travel while on turbo is determined by the following formula:
    // Distance = Acc * TurboFactor * (Duration ^ 2)
    var distanceInTurbo = 400.0; //(2 * currentAcc * car.turboFactor * Math.pow(car.turboDurationTicks, 2));
    // We have to know as well at what distance from the bend the car will begin to break...

    // If the distance to the next bend is greater than the distance the car will travel in Turbo, turbo away!
    return (distanceToBend > distanceInTurbo || car.biggestStraightIndex === car.currentPiece.index
            || car.inLastStraight());
};

// ***** Switch intelligence ***** //

Driver.prototype.determineSwitchDirection = function() {
    return this.switchAI.determineSwitchDirection();
};

function declarePrivateMethods() {

}

module.exports = Driver;
