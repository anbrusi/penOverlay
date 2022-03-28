<?php
class penOverlay {
    private function head():string {
        $html = '';
        $html .= '<head>';
        $html .= '<meta charset="UTF-8">';
        $html .= '<title>penOverlay</title>';
        $html .= '</head>';
        return $html;
    }
    private function loadView():string {
        $html = '';
        $html .= '<h1>Load a document</h1>';
        $html .= '<form action="http://myProjects/penOverlay/index.php" method="POST">';
        $files = scandir('testFiles');
        if ($files === false) {
            $html .= 'No loadable files found';
        } else {
            $html .= '<select name="files">';
            foreach ($files as $file) {
                if ($file != '.' && $file != '..') {
                    $html .= '<option value="'.$file.'">'.$file.'</option>';
                }
            }
            $html .= '</select>';
        }
        $html .= '<p>';
        $html .= '<input type="submit" name="load" value="Load">';
        $html .= '</p>';
        $html .= '</form>';
        return $html;
    }
    /**
     * Wraps the HTML document, which should be annotated by pen in a stanard way
     * 
     * @param string $html the raw document, which will be annotated or prepared for annotation 
     * @return string 
     */
    private function wrap(string $html):string {
        $wrapped = '';
        $wrapped .= '<!--penOverlay-->';
        $wrapped .= '<div id="penov-main">';
        $wrapped .= '<div id="penov-raw">';
        $wrapped .= $html;
        $wrapped .= '</div>'; // penow-raw
        $wrapped .= '<canvas id="penov-canvas" data-penov=""></canvas>';
        $wrapped .= '</div>'; // penov-main
        return $wrapped;
    }
    private function correctionView():string {
        $html = '';
        $html .= '<div id="penov-parent">';
        if (isset($_POST['files'])) {
            $rawContent = file_get_contents('testFiles/'.$_POST['files']);
            if (strpos(trim($rawContent), '<!--penOverlay-->') === 0) {
                $html .= $rawContent;
            } else {
                $html .= $this->wrap($rawContent);
            }
        }
        $html .= '</div>'; // penov-parent

        // Load PenOverlay. NOTE: did not work, if inserted after the form
        $params = array('parentid' => 'penov-parent');
        $jsonParams = json_encode($params);
        $html .= '<script type="module">';
        $html .=    'import {attachPenOverlay} from "./isJS/modularJS/penOverlay.js";';
        $html .=    'attachPenOverlay(\''.$jsonParams.'\');';
        $html .= '</script>';
        
        // Button form
        $html .= '<form action="http://myProjects/penOverlay/index.php" method="POST">';
            $html .= '<p>';
            $html .= '<input type="submit" name="escape" value="Escape">';
            $html .= '&nbsp;&nbsp;';
            $html .= '<input type="submit" name="penov-store" value="Store">';
            $html .= '</p>';
            // Save the loaded filename for future use
            $html .= '<input type="hidden" name="file" value="'.$_POST['files'];
        $html .= '</form>';
        return $html;
    }
    private function body():string {
        $html = '';
        $html .= '<body>';
        if (isset($_POST['load'])) {
            $html .= $this->correctionView();
        } elseif (isset($_POST['penov-store'])) {
            $html .= $this->loadView();
        } else {
            $html .= $this->loadView();
        }
        $html .= '</body>';
        return $html;
    }
    public function dispatch() {
        $html = '';
        $html .= '<html>';
        $html .= $this->head();
        $html .= $this->body();
        $html .= '</html>';
        echo $html;
    }
}
$penOverlay = new penOverlay();
$penOverlay->dispatch();