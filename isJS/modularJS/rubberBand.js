export {RubberBand}

class RubberBand {
    /**
     * The positioned elemen, which will contain the rubber band
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
    rBorder = '1px dashed black';
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
    enabled = true;
    /**
     * true iff the rubber band is visible
     */
    visible = false;
    /**
     * The mode of reaction to pointer commands
     */
    mode = 'none';

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
            this.rBand.style.top = this.rTop;
            this.rBand.style.left = this.rLeft;
            this.rBand.style.height = this.rHeight;
            this.rBand.style.width = this.rWidth;
            this.rBand.style.border = this.rBorder;
            // Initially the rubber band is hidden
            this.rBand.style.display = 'none';
            this.parent.appendChild(this.rBand);
        }
    }
    enable() {

    }
    disable() {
        
    }
}