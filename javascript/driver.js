var Car = require('./car.js');

function Driver(car) {
	this.car = car;
	this.checkSwitch = true;

	this.bendFactor = 67500.0;
    this.frictionFactor = 49.0;

    // Breaking-learn function
    this.ticksBreaking = 0;
    this.lastFrictionFactors = new Array();
    this.speedAccelerationFactor = 49
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

Driver.prototype.driveForStraight = function() {
	var car = this.car;
    var nextBendPiece = car.bendsAhead[0];

    // This calc in here, is only for the log
    // TODO: Fazer o calculo do targetSpeed apenas uma vez. Colocar esse cara como uma variavel de instancia.
    var targetSpeed = targetSpeedCalc(car, nextBendPiece, this.frictionFactor, true);
    console.log("targetSpeed: " + targetSpeed + " carAngle: " + car.angle);

    return this.speedInStraight();
};

Driver.prototype.driveForBend = function() {
    var car = this.car;
    var currentAcc = car.acceleration;
    var nextBendPiece = car.bendsAhead[0];

    // This calc in here, is only for the log
    var targetSpeed = targetSpeedCalc(car, nextBendPiece, this.frictionFactor, true);
    console.log("targetSpeed: " + targetSpeed + " carAngle: " + car.angle);

    return this.speedInBend();
}

// ***** Speed calculations ***** //

Driver.prototype.speedInBend = function() {
    // This is for breaking-learn functions
    this.ticksBreaking = 0;

    var car = this.car;
    var currentPiece = car.currentPiece;
    var angleAbs = Math.abs(car.angle);
    var lastAngleAbs = Math.abs(car.lastAngle);

    //var limitAngle = 60.0 - (this.bendFactor / Math.abs(currentPiece.angle * currentPiece.radius));

    if(this.shouldBreak())
        return 0.0;

    if(willSlip(car, 60))
        return 0.0;

    if (angleAbs < lastAngleAbs)
        return 1.0;

    var angleDiff = angleAbs - lastAngleAbs;
    if (angleDiff > 4.0)
        return 0.0;

    return 1.0;// - (angleAbs / limitAngle) ;
}

// old speed in bend
/*

 function speedInBend(car){
 const maxAngle = 45.0;
 var angleAbs = Math.abs(car.angle);
 var lastAngleAbs = Math.abs(car.lastAngle);

 if(shouldBreak(car))
 return 0.0;

 if(willSlip(car, maxAngle))
 return 0.0;

 var angleDiff = angleAbs - lastAngleAbs;
 if(angleDiff <= 0 ) //&& car.nextDifferentPiece.angle <= car.currentPiece.angle)
 return 1.0;

 if(angleDiff > maxAngle * 0.08)
 return 0.0;

 return 1.0 - angleAbs / maxAngle;
 }
 */

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

Driver.prototype.calculateFrictionFactor = function(){
    // This will calculate the friction factor and...
    // IMPORTANT! This function can only be called in a straight and when the car is breaking

    const frictionAdjustFactor = 0;

    // only in negative acceleration
    if(this.car.acceleration > 0)
        return;

    // This is for breaking-learn functions
    this.ticksBreaking ++;
    console.log(" TicksBreaking " + this.lastFrictionFactors.length)
    console.log(" Factors " + this.lastFrictionFactors);
    // If less, the breaking speed is not ok for the calculation
    if(this.ticksBreaking <= 3)
        return;

    // If the angle is too high, it must not calculate
    if(this.car.angle > 6 || this.car.angle < -6)
        return;

    // To stay this array smaller, don't need too much data and take out the biggest and the lower
    if(this.lastFrictionFactors.length > 21){
        this.lastFrictionFactors.shift();
        this.lastFrictionFactors.pop();
    }

    var car = this.car;
    var speed = this.car.lastSpeed;
    var acceleration = this.car.acceleration;

    this.lastFrictionFactors.push(Math.abs(speed / acceleration));

    if(this.lastFrictionFactors.length > 3){
        this.frictionFactor = averageOfNumberArray(this.lastFrictionFactors, this.frictionFactor);
        console.log(" New friction factor: " + this.frictionFactor);

        // To stay this array clean, remove some elements out of the average.
        // This is MOD 10, because I don't want to to this all the time. maybe 2 or 3 items are making this get
        // out of the average
        if(this.lastFrictionFactors.length % 5 != 0)
            return;

        // the most probably cause of a uncommon values are the lasts added ;)
        this.lastFrictionFactors.sort(function(a,b){return a-b});
        console.log(this.lastFrictionFactors);

        //Math.floor for now, but we got to know if we use the upper or lower median
        var med = this.lastFrictionFactors[Math.floor(this.lastFrictionFactors.length / 2)]

        var i = -1;
        while( ++ i < this.lastFrictionFactors.length ){

            // Ajustar a variância pra 5%
            if(this.lastFrictionFactors[i] > med * 1.025
                || this.lastFrictionFactors[i] < med * 0.975){
                console.log(" Factor removed: " + this.lastFrictionFactors[i] + " Average: " + this.frictionFactor);
                this.lastFrictionFactors.splice(i, 1);
                // If something is removed, new average is set, otherwise, it'll return the same value
                this.frictionFactor = averageOfNumberArray(this.lastFrictionFactors, this.frictionFactor);
            }
        }

    }
    // Adjust factor
    this.frictionFactor += frictionAdjustFactor;


}

Driver.prototype.speedInStraight = function(){

    if ( !this.shouldBreak() ) {
        //The turbo logic is now in canTurbo()
        // To use more efficiently the turbo, the driver will only activate it when the car is at the
        // first piece of the biggest straight in the track or in the lastStraight
        //if (this.car.inLastStraight()) {
        //    if (this.car.turboAvailable) {
        //        this.car.turboAvailable = false;
        //        return 2.0; // to activate turbo in throttle function
        //    }
        //    return 1.0;
        //}

        // This is for breaking-learn functions
        this.ticksBreaking = 0;
        return 1.0;
    }

    this.calculateFrictionFactor();

    return 0.0;
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

Driver.prototype.shouldBreak = function(){
    var car = this.car;
    var currentSpeed = car.speed();

    var distanceToBend = car.distanceToBend();
    var distanceToBendAhead = car.distanceToPiece(car.bendsAhead[1]);

    // Target speed to entering bends. It'll be calculated using bend radius and size
    var targetSpeed = targetSpeedCalc(car, car.bendsAhead[0], this.frictionFactor);
    var targetSpeedForBendAhead = targetSpeedCalc(car, car.bendsAhead[1], this.frictionFactor);

    if(car.inLastStraight())
        return false;

    // Verify if it is time to break for the bend 2x ahead
    //if(isTimeToBreak(currentSpeed, distanceToBend2TimesAhead, targetSpeedForBend2TimesAhead, this.frictionFactor)){
    //    console.log(" breaking for bend 2x ahead... ")
    //    return true;
    //}
    // Verify if it is time to break for the bend ahead
    if(isTimeToBreak(currentSpeed, distanceToBendAhead, targetSpeedForBendAhead, this.frictionFactor)){
        console.log(" breaking for bend ahead... ");
        return true;
    }
    // If it is in a bend, only verify the bend ahead speed. Logic for bend speed is in speed in bend function
    //if(car.currentPiece.type == "B")
    //    return false;

    // Verify if it is time to break for the next bend
    return isTimeToBreak(currentSpeed, distanceToBend, targetSpeed, this.frictionFactor);
}

function isTimeToBreak(currentSpeed, distanceToBend, targetSpeed, frictionFactor){

    // FrictionFactor is the relation between speed and negative acceleration when the car is
    // fully breaking in a Straight piece.
    // It'll be calculated for each race when breaking in the firsts bends because of the
    // possibility to have a value for each track
    //var frictionFactor = 49;

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

function willSlip(car, maxAngle){
    var angleAbs = Math.abs(car.angle);
    var nextBendPiece = car.bendsAhead[0];

    var ticksToNextBend = car.distanceToBend() / car.lastSpeed;
    var ticksToAngleSixty = Math.abs((maxAngle - angleAbs) / car.angleSpeed);

    // Fator que aumenta o numero de ticks necessarios para o carro chegar ao angulo 60. Utilizado para evitar
    // que o carro chegue ao angulo 60 e derrape.
    // TODO: Alterar essa variavel para uma constante de Driver;
    var securityFactor = 1;

    var angleIsIncreasing = ( car.angleSpeed > 0 && car.angle > 0 ) ||
                            ( car.angleSpeed < 0 && car.angle < 0 );

    if(checkSlip(ticksToNextBend,
                 securityFactor,
                 angleIsIncreasing,
                 ticksToAngleSixty))
        return true;

    // TODO: TROCAR ESSE WORKAROUND POR UMA VALIDAÇÃO AJUSTADA PARA A PROXIMA CURVA (DEPOIS EU EXPLICO)
    if(nextBendPiece.index <= car.currentPiece + 2)
        return false;

    // Prevent ricochet (rebound)
    angleIsIncreasing = ( nextBendPiece.angle > 0 && car.angleSpeed > 0 ) ||
                        ( nextBendPiece.angle < 0 && car.angleSpeed < 0 );

    return checkSlip(ticksToNextBend,
                     securityFactor,
                     angleIsIncreasing,
                     ticksToAngleSixty);
}

function checkSlip(ticksToNextBend, securityFactor, angleIsIncreasing, ticksToAngleSixty) {
    if((ticksToNextBend + securityFactor > ticksToAngleSixty) &&
        angleIsIncreasing) {

        console.log("ticksToNextBend "+ ticksToNextBend + " ticksToAngleSixty " + ticksToAngleSixty);
        return true;
    }
    return false;
}

function targetSpeedCalc(car, piece, frictionFactor, log){
    // New, beautiful and optimized calculation

    // First, initialize many constants
    const gravity = 9.78 ;
    const secondsPerTick = 1/60;

    const radius = piece.radius;
    const radianAngle = piece.angleInRadians;
    const angle = piece.angle;

    var laneDistanceFromCenter = calculateLaneDistanceFromCenter(car, piece);

    //console.log(laneDistanceFromCenter + " <<-- " + piece.laneDistanceFromCenter(lane))

    var radiusInLane = radius + laneDistanceFromCenter;
    var maxFriction = Math.sqrt( radiusInLane * (Math.abs(angle) / gravity ));
    var targetSpeed = ( Math.sqrt( maxFriction * radiusInLane * gravity) / (50/3) )  ;



    //if(log === true)
    //    console.log(" speed original " + targetSpeed);

    // 50% of the factor is defined by the bend and 50% by the friction factor
    var factor = Math.abs( targetSpeed  / (radius * angle )) * 50;
    targetSpeed -= targetSpeed * (factor * ( frictionFactor / 50)) ;


    return targetSpeed;







/*

 if(log === true)
 console.log(" speed original " + targetSpeed);



 var factor = Math.abs(targetSpeed / (radius * angle)) * 100;
    targetSpeed -= targetSpeed * (factor) ;
 if(log === true)
 console.log(" speed 2 " + targetSpeed);

 var frictionMultiplier =Math.abs( (Math.pow(frictionFactor,2) / (Math.pow(targetSpeed,2) * Math.sqrt(Math.pow(frictionFactor,2)))) - 1 )/ (frictionFactor /10) ;
 if(log === true)
 console.log(" Multiplier " + frictionMultiplier);
 if(targetSpeed < Math.sqrt(frictionFactor))
 targetSpeed *= 1+ frictionMultiplier;

    //if(targetSpeed < 4)
    //    targetSpeed *= 1.15;
    //else if(targetSpeed < 6)
    //    targetSpeed *= 1.1;
 return targetSpeed;//*0.98;

 */










    // Old calc
    //var maxFriction = Math.sqrt( radiusInLane * (Math.abs(radianAngle) / gravity ))
    //var targetSpeed = ( Math.sqrt( maxFriction * radiusInLane ) / 6 ) ;

    // New calc (slower)
    //var radiusInLane = radius + laneDistanceFromCenter;
    //var targetSpeed = Math.sqrt( frictionFactor * radiusInLane * gravity) ;
    //return targetSpeed / 60;

    //Another calc
    //var radiusInLane = radius + laneDistanceFromCenter;
    //var maxFriction = Math.sqrt( radiusInLane * (Math.abs(angle) / gravity ))
    //var fasterSpeed = ( Math.sqrt( maxFriction * radiusInLane ) / 6.0 )
    //var radiusInLane = radius + laneDistanceFromCenter;
    //var targetSpeed = Math.sqrt( frictionFactor * radiusInLane * gravity) ;
    //var slowerSpeed = targetSpeed / 60.0;
    //var targetSpeed = fasterSpeed - slowerSpeed;
    //return  fasterSpeed - targetSpeed * 0.4;


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
	var distanceInTurbo = 400.0; //(2 * currentAcc * car.turboFactor * Math.pow(car.turboDurationTicks, 2));
	// We have to know as well at what distance from the bend the car will begin to break...
	
	// If the distance to the next bend is greater than the distance the car will travel in Turbo, turbo away!
	return (distanceToBend > distanceInTurbo || car.biggestStraightIndex === car.currentPiece.index
            || car.inLastStraight());
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
