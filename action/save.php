<?php
    
    if (!defined('DOKU_INC'))
        define('DOKU_INC', realpath(dirname(__FILE__) . '/../../../') . '/');
    if (!defined('DOKU_PLUGIN'))
        define('DOKU_PLUGIN', DOKU_INC . 'lib/plugins/');
    require_once(DOKU_PLUGIN . 'action.php');
    
    class action_plugin_dvedit_save extends DokuWiki_Action_Plugin
    {
        function register(Doku_Event_Handler $controller)
        {
            // found in ckgedit
            $controller->register_hook('DOKUWIKI_STARTED', 'BEFORE', $this, 'preprocess');
        }

        function preprocess(Doku_Event $event)
        {
            global $ACT;
            if (!isset($_REQUEST['dvedit']) || !is_array($ACT) || !(isset($ACT['save']) || isset($ACT['preview'])))
                return;
            global $TEXT, $conf;
            
            
        }
    }
    
?>