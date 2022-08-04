export {RubberLine}

/**
 * Draws a rubber line from a fixed point to the current pointer position
 * If enabled pointer down sets the start point, pointer move draws a line from the start point to the current
 * pointer position and pointer up removes the line. 
 * Pointer up fires a custom event, returning start and end positions of the line
 * 
 * Usage:
 * The using script imports RubberLine and calls the constructor "this.rubberLine = new RubberLine(rbParams);"
 * This instantiates a property rubberLine in the calling class. The rubber line is disabled.
 * If the calling class wants to use the rubber line it sets "this.rubberLine.enabled = true;"
 * After use it sets enabled to false again. 
 * Typical is a calling script having different modes. "enabled" is set when entering and leaving a mode, using the rubber line
 */
class RubberLine {

    /**
     * The positioned element, which will contain the rubber band
     */
    parent = undefined;
    /**
     * The div acting as rubber line
     */
    rLine = undefined;
    /**
     * Initial border style
     */
    rBorder = '2px solid red';
    /**
     * The pointer can serve different purposes besides configuring the rubber band
     * It is the responsability of the script using this module, to decide wheter 
     * pointer actions refer to the rubber band or something else. 
     * Pointer handlers are active only if this.enabled = true
     */
    enabled = false;
     /**
      * The fixed point of the line set by pointer down
      */
    startPoint = undefined;
    /**
     * The pointer is down for rubber line display
     */
    pointerDown = false;

    constructor(params) {
        // Override default initial values
        if (params.rBorder) {
            this.rBorder = params.rBorder;
        }
        if (params.parentid) {
            this.parent = document.getElementById(params.parentid);
            // Build the div, whose border will act as rubber band
            this.rLine = document.createElement('div');
            this.rLine.style.position = 'absolute';
            this.rLine.style.border = this.rBorder;
            // Initially the rubber band is hidden
            this.rLine.style.display = 'none';
            this.parent.appendChild(this.rLine);
        }
    }
    /**
     * Called upon termination. Destroys allocated resources, in particular the div representing the rubber band
     */
    terminate() {
        if (this.rLine) {
            this.rLine.remove();
        }
    }
    enable() {
        this.rLine.style.top = this.startPoint.y + 'px';
        this.rLine.style.left = this.startPoint.x + 'px';
        this.rLine.style.height = '0px';
        this.rLine.style.width = this.rWidth + '2px';
        this.rLine.style.display = 'block';
    }
    disable() {        
        this.rLine.style.display = 'none';
    }
    /**
     * Returns the position of the event relative to the parent element as an object with properties 'x' and 'y'
     * 
     * @param {object} event 
     */
    parentPos(event) {
        let parentRect = this.parent.getBoundingClientRect();
        let x = event.pageX - parentRect.left - window.scrollX;
        // Avoid quitting the parent
        if (x > parentRect.width) {
            x = parentRect.width - 4; // 4 is an experimental value
        }
        let y = event.pageY - parentRect.top - window.scrollY;
        if (y > parentRect.height) {
            y = parentRect.height - 4;
        }
        return {
            x: x,
            y: y
        }
    }
    setEndpoint(x, y) {
        let dx = x - this.startPoint.x;
        let dy = y - this.startPoint.y;
        let length = Math.sqrt(dx * dx + dy * dy);
        let angle = Math.atan2(dy, dx);
        this.rLine.style.width = length + 'px';
        this.rLine.style['transform-origin'] = 'top left';
        this.rLine.style.transform = 'rotate(' + angle + 'rad)';
    }
    addListeners() {
        this.parent.addEventListener('pointerdown', this.boundDownH);
        // We attach the listeners to document, because they must be able to react appropriately when the pointer leaves 'parent'
        document.addEventListener('pointermove', this.boundMoveH);
        document.addEventListener('pointerup', this.boundUpH);
    }
    removeListeners() {
        this.parent.removeEventListener('pointerdown', this.boundDownH);
        document.removeEventListener('pointermove', this.boundMoveH);
        document.removeEventListener('pointerup', this.boundUpH);
    }
    /**
     * ======================
     * Listeners
     * ======================
     */
    downH(event) {
        if (this.enabled) {
            event.preventDefault();
            this.startPoint = this.parentPos(event);
            this.setEndpoint(this.startPoint.x, this.startPoint.y);
            this.enable();
            this.pointerDown = true;
        }
    }
    boundDownH = this.downH.bind(this);
    moveH(event) {
        if (this.enabled && this.startPoint && this.pointerDown) {
            console.log('rubberLine move');
            event.preventDefault();
            let pos = this.parentPos(event);
            this.setEndpoint(pos.x, pos.y);
        }
    }
    boundMoveH = this.moveH.bind(this);
    upH(event) {
        if (this.enabled && this.pointerDown) {
            event.preventDefault();
            let pos = this.parentPos(event);
            this.disable();
            // Create and dispatch a custom event
            let info = {startPoint: this.startPoint,
                        endPoint: pos}; 
            const customEvent = new CustomEvent('rubberLine', {detail: info});
            this.parent.dispatchEvent(customEvent);
            this.pointerDown = false;
        }
    }
    boundUpH = this.upH.bind(this);
}