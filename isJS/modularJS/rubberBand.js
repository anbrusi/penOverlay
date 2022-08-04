export {RubberBand}
/**
 * The aim of this class is to display a rectangle on top of the current image, which has a fixed corner and
 * adapts to pointer position for the diagonally opposed corner.
 * A div with a choosable border is placed in a fixed position on inside a parent element, whose id is given by
 * the property 'parentid' in the object 'params' of the constructor. The position inside the parent
 */
class RubberBand {
    /**
     * The positioned element, which will contain the rubber band
     */
    parent = undefined;
    /**
     * The div acting as rubber band
     */
    rBand = undefined;
    /**
     * Initial top of rubber band
     */
    rTop = 0;
    /**
     * Initial left of rubber band
     */
    rLeft = 0;
    /**
     * Initial right of rubber band
     */
    rHeight = 10;
    /**
     * Initial width of rubberBand
     */
    rWidth = 10;
    /**
     * Initial border style
     */
    rBorder = '2px dashed red';
    /**
     * The dynamic properties of the rubber band
     */
    rType = 'configure';
    /**
     * The pointer can serve different purposes besides configuring the rubber band
     * It is the responsability of the script using this module, to decide wheter 
     * pointer actions refer to the rubber band or something else. 
     * Pointer handlers are active only if this.enabled = true
     */
    enabled = false;
    /**
     * true iff the rubber band is visible
     */
    visible = false;
    /**
     * The mode of reaction to pointer commands
     */
    mode = 'none';
    /**
     * Current values of the div acting as rubber band
     */
    top = undefined;
    left = undefined;
    height = undefined;
    width = undefined;

    constructor(params) {
        // Override default initial values
        if (params.rTop) {
            this.rTop = params.rTop;
        }
        if (params.rLeft) {
            this.rLeft = params.rLeft;
        }
        if (params.rHeight) {
            this.rHeight = params.rHeight;
        }
        if (params.rWidth) {
            this.rWidth = params.rWidth;
        }
        if (params.rBorder) {
            this.rBorder = params.rBorder;
        }
        if (params.rType) {
            this.rType = params.rType;
        }
        if (params.parentid) {
            this.parent = document.getElementById(params.parentid);
            // Build the div, whose border will act as rubber band
            this.rBand = document.createElement('div');
            this.rBand.style.position = 'absolute';
            this.rBand.style.border = this.rBorder;
            // Initially the rubber band is hidden
            this.rBand.style.display = 'none';
            this.parent.appendChild(this.rBand);
        }
    }
    /**
     * Called upon termination. Destroys allocated resources, in particular the div representing the rubber band
     */
    terminate() {
        if (this.rBand) {
            this.rBand.remove();
        }
    }
    enable(top, left) {
        this.rBand.style.top = top + 'px';
        this.rBand.style.left = left + 'px';
        this.rBand.style.height = this.rHeight + 'px';
        this.rBand.style.width = this.rWidth + 'px';
        this.rBand.style.display = 'block';
    }
    disable() {        
        this.rBand.style.display = 'none';
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
            let pos = this.parentPos(event);
            // The pointer always is at the lower right corner.
            this.top = pos.y - this.rHeight;
            if (this.top < 0) {
                this.top = 0;
            }
            this.left = pos.x - this.rWidth;
            if (this.left < 0) {
                this.left = 0;
            }
            this.enable(this.top, this.left);
        }
    }
    boundDownH = this.downH.bind(this);
    moveH(event) {
        if (this.enabled) {
            event.preventDefault();
            let pos = this.parentPos(event);
            if (pos.y > this.top) {
                this.height = pos.y - this.top;
            }
            if (pos.x > this.left) {
                this.width = pos.x - this.left
            }
            this.rBand.style.height = this.height + 'px';
            this.rBand.style.width = this.width + 'px';
        }
    }
    boundMoveH = this.moveH.bind(this);
    upH(event) {
        if (this.enabled) {
            event.preventDefault();
            let pos = this.parentPos(event);
            if (pos.y > this.top) {
                this.height = pos.y - this.top;
            }
            if (pos.x > this.left) {
                this.width = pos.x - this.left
            }
            this.disable();
            // Create and dispatch a custom event
            let info = {top: this.top, 
                        left: this.left,
                        height: this.height,
                        width: this.width};
            const customEvent = new CustomEvent('rubberRectangle', {detail: info});
            this.parent.dispatchEvent(customEvent);
        }
    }
    boundUpH = this.upH.bind(this);
}