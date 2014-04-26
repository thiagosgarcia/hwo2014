var Car = require('./car.js');

function Driver(car) {
	this.car = car;
	this.checkSwitch = true;
	
	this.bendFactor = 67500.0;
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
}

Driver.prototype.driveForStraight = function() {
	var car = this.car;
    var distanceToBend = car.distanceToBend();
    var currentSpeed = car.speed();
    var turboDurationTicks = car.turboDurationTicks;
    var turboFactor = car.turboFactor;

    // Target speed to entering bends. It'll be calculated using bend radius and size
    // (to be implemented)
    var targetSpeed = targetSpeedCalc(car);
    //var targetSpeed = 4.5;
    console.log("targetSpeed: " + targetSpeed + " carAngle: " + car.angle);
    if ( !isTimeToBreak(currentSpeed, distanceToBend, targetSpeed) || car.inLastStraight()){
        // To use more efficiently the turbo, the driver will only activate it when the car is at the
        // first piece of the biggest straight in the track or in the lastStraight
        if(car.inLastStraight() && car.turboAvailable ){
            car.turboAvailable = false;
            return 2.0; // to activate turbo in throttle function
        }
    	return 1.0;
    }
    
    return 0.0;
}

Driver.prototype.driveForBend = function() {
    var car = this.car;
    var currentSpeed = car.speed();
    var distanceToBend = car.distanceToBend();
    var currentAcc = car.acceleration;

    // Target speed to entering bends. It'll be calculated using bend radius and size
    // (to be implemented)
    var targetSpeed = targetSpeedCalc(car);
    console.log("targetSpeed: " + targetSpeed + " carAngle: " + car.angle);

    return speedInBend(car);
}

// ***** Speed calculations ***** //

function isTimeToBreak(currentSpeed, distanceToBend, targetSpeed){

    // BreakingFactor is the relation between speed and negative acceleration when the car is
    // fully breaking in a Straight piece.
    // It'll be calculated for each race when breaking in the firsts bends because of the
    // possibility to have a value for each track
    var breakingFactor = 49;

    // Now with the target speed adjusted, I don't see this use, but I'll let it here for now
    // This is a delay for breaking. Less, the pilot breaks earlier, more the pilot breaks later.
    // 4 - 5 value makes the pilot break pretty securely and close to the bend.
    // Smaller values may be used when the car is in the inner lane, greater when it is in the outer lane
    // carefully, of course
    var breakingTicksDelay = -2 ;

    // Now with the target speed adjusted, I don't see this use, but I'll let it here for now
    // lower speeds needs less breaking tick delay
    //if(targetSpeed < 5)
    //    breakingTicksDelay--;

    var speedDiff = currentSpeed - targetSpeed;
    // If the speed is less than target speed there's no need to break
    if(speedDiff <= 0)
        return false;

    // Calculate the breaking acceleration if the car fully breaks with current speed
    var currentBreakAcceleration = currentSpeed / breakingFactor;
    // Calculate the breaking acceleration in target speed
    var targetBreakAcceleration = targetSpeed / breakingFactor;
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

Driver.prototype.speedInBend = function() {
    var car = this.car;
    var currentPiece = car.currentPiece;
    var angleAbs = Math.abs(car.angle);
    var lastAngleAbs = Math.abs(car.lastAngle);

    var limitAngle = 60.0 - (this.bendFactor / Math.abs(currentPiece.angle * currentPiece.radius));

    if (angleAbs < lastAngleAbs)
        return 1.0;

    var angleDiff = angleAbs - lastAngleAbs;
    if (angleDiff > 4.0)
        return 0.0;

    return 1.0 - (angleAbs / limitAngle);
}
// old speed in bend
/*
 function speedInBend(car){

 function speedInBend(car){
 const maxAngle = 45.0;
 var angleAbs = Math.abs(car.angle);
 var lastAngleAbs = Math.abs(car.lastAngle);

 if(willSlip(car, maxAngle))
 return 0;

 if(angleAbs < lastAngleAbs && ( car.nextDifferentPiece.type == "B" && car.nextDifferentPiece.angle <= car.currentPiece.angle))
 return 1.0;

 var angleDiff = angleAbs - lastAngleAbs;
 if(angleDiff > maxAngle * 0.1)
 return 0.0;

 var speed = 1.0 - angleAbs / maxAngle;
 if(speed > 0.7)
 speed = 1;
 return speed;
 }
 */

function willSlip(car, maxAngle){
    var angleAbs = Math.abs(car.angle);
    var lastAngleAbs = Math.abs(car.lastAngle);
    var ticksToNextDifferentPiece = car.distanceToPiece(car.nextDifferentPiece);
    var ticksToAngleSixty = Math.abs((60.0 - angleAbs) / car.angleAcceleration);


    if(angleAbs > maxAngle / 2 && ticksToNextDifferentPiece > ticksToAngleSixty ){
        console.log("ticksToNextDifferentPiece "+ ticksToNextDifferentPiece + " ticksToAngleSixty " + ticksToAngleSixty)
        return true;
    }
    return false;
}

function targetSpeedCalc(car){
    // New, beautiful and optimized calculation

    // First, initialize many constants
    const gravity = 9.78 ;
    const secondsPerTick = 1/60;
    const frictionFactor = 49;
    const nextBendPiece = car.nextBendPiece;
    const nextSwitchPiece = car.nextSwitchPiece;
    const radius = car.nextBendPiece.radius;
    const radianAngle = car.nextBendPiece.angleInRadians;
    const angle = car.nextBendPiece.angle;
    const lane = car.lane;
    const lanes = car.track.lanes;
    const switchDirection = car.driver.determineSwitchDirection()

    var laneDistanceFromCenter = 0.0;
    if(nextBendPiece.index < nextSwitchPiece.index){
        // If next bend is before the switch, next bend calc is for the actual lane
        laneDistanceFromCenter = nextBendPiece.laneDistanceFromCenter(lane);
    }else{
        // If next bend is the next switch or the next switch is before the next bend we must calc
        // the speed for the lane that the car will be
        laneDistanceFromCenter  = switchDirection == null ? nextBendPiece.laneDistanceFromCenter(lane)
            : switchDirection == 'Right' ?  nextBendPiece.laneDistanceFromCenter(lanes[lane.index + 1])
            : nextBendPiece.laneDistanceFromCenter(lanes[lane.index - 1]);
    }


    //console.log(laneDistanceFromCenter + " <<-- " + nextBendPiece.laneDistanceFromCenter(lane))

    var radiusInLane = radius + laneDistanceFromCenter;
    var maxFriction = Math.sqrt( radiusInLane * (Math.abs(angle) / gravity ))
    var fasterSpeed = ( Math.sqrt( maxFriction * radiusInLane ) / 6.0 )


    var radiusInLane = radius + laneDistanceFromCenter;
    var targetSpeed = Math.sqrt( frictionFactor * radiusInLane * gravity) ;
    var slowerSpeed = targetSpeed / 60.0;

    var targetSpeed = fasterSpeed - slowerSpeed;
    return  fasterSpeed - targetSpeed * 0.4;


    // Old calc
    //var maxFriction = Math.sqrt( radiusInLane * (Math.abs(radianAngle) / gravity ))
    //var targetSpeed = ( Math.sqrt( maxFriction * radiusInLane ) / 6 ) ;

    // New calc (slower)
    //var radiusInLane = radius + laneDistanceFromCenter;
    //var targetSpeed = Math.sqrt( frictionFactor * radiusInLane * gravity) ;
    //return targetSpeed / 60;

}

// ***** Turbo intelligence ***** //

// Determine, by the car position in the track, if this tick is the right moment
// to use the active turbo;
Driver.prototype.canTurbo = function() {

    // Disabled temporarily
    return false;

	var car = this.car;
	var currentPiece = car.currentPiece;
	var currentAcc = this.car.acceleration;
	
	// If the car is breaking (acc <= 0.0), the turbo will not be optmized
	if(currentAcc <= 0.0)
		return false;
	
	// If the currentPiece the car is on is a Bend, we have to check if the car is on its exit;
	if(currentPiece.type == "B") {
		// Check if the car is on the last half of the Bend;
        // -> It was not working harder bends, let's do this in the last quarter for now
		var bendLength = currentPiece.lengthInLane(car.lane);
		if(car.inPieceDistance < (bendLength * 0.75))
			return false;
		
		// Check if the car angle is low enough to be safe to use the turbo
        // -> The angle for turbo may must be lower, but the condition ahead should be enough. This is an alert point
		if(car.angle > 45.0 || car.angle < -45.0)
			return false;
	}
	
	var distanceToBend = car.distanceToBend();
	// The distance the car will travel while on turbo is determined by the following formula:
	// Distance = Acc * TurboFactor * (Duration ^ 2)
	var distanceInTurbo = 400.0 //(2 * currentAcc * car.turboFactor * Math.pow(car.turboDuration, 2));
	// We have to know as well at what distance from the bend the car will begin to break...
	
	// If the distance to the next bend is greater than the distance the car will travel in Turbo, turbo away!
	return (distanceToBend > distanceInTurbo * 4 || car.biggestStraightIndex === car.currentPiece.index);
}

// ***** Switch intelligence ***** //

// This algorithm will sum the length of all the lanes in the bends between two switches,
// and send the switch message to the direction of the lane with the shorter length.
// The less ground to cross, the lesser the time to cross it;
Driver.prototype.determineSwitchDirection = function() {
	var car = this.car; 
	var nextBends = new Array();
	var nextSwitch = null;
	
	var nextPieceIndex = car.currentPiece.index + 1;
	while(true) {
		if(car.track.pieces.length <= nextPieceIndex)
			nextPieceIndex = 0;
		
		var nextPiece = car.track.pieces[nextPieceIndex];
	
		if(nextPiece.switch) {
			// Found the second switch, after one or more bend pieces were found in between them. Stop the loop;
			if(!!nextSwitch && nextBends.length > 0) break;
			
			// Found the first switch, assign it to nextSwitch;
			nextSwitch = nextPiece;
		} 
		
		if (nextPiece.type == "B") {
			// Found a bend before a switch, break;
			if(nextSwitch == null) break;
		
			nextBends.push(nextPiece);
		}
		
		nextPieceIndex++;
	}
	
	// Only calculate the direction if a switch were found before the next bend.
	if(!!nextSwitch && nextBends.length > 0) {
		var lanes = car.track.lanes;
		var shorterLane = null;
		
		// Determine the shorter lane in the bends after the nextSwitch
		for(var i = 0; i < lanes.length; i++) {
			var lane = lanes[i];
			var laneLength = 0;
			
			for(var j = 0; j < nextBends.length; j++) {
				var bend = nextBends[j];
				laneLength += bend.lengthInLane(lane);
			}
			
			if(shorterLane == null || laneLength < shorterLane.length) {
				shorterLane = lane;
				shorterLane.length = laneLength;
			}
		}
		
		// The shorter lane is more to the left of the center, switch Left.
		if(car.lane.distanceFromCenter > shorterLane.distanceFromCenter) {
            return 'Left';
		}
		// The shorter lane is more to the right of the center, switch Right.
		else if(car.lane.distanceFromCenter < shorterLane.distanceFromCenter) {
			return 'Right';
		}
		
		// The lane the car is driving is already the shorter! Nothing to do here..
	}
    return null;
}

module.exports = Driver;
