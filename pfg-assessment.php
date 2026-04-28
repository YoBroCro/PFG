<?php
/**
 * Plugin Name: PFG Predictive Index Assessment
 * Description: GLO PFG Predictive Index - Secure manager assessment tool with 10 CSF scoring.
 * Version:     1.0.0
 * Author:      PFG
 * Text Domain: pfg-assessment
 */

if ( ! defined( 'ABSPATH' ) ) exit;

define( 'PFG_PLUGIN_URL', plugin_dir_url( __FILE__ ) );
define( 'PFG_PLUGIN_DIR', plugin_dir_path( __FILE__ ) );

// ─── ACTIVATION ───────────────────────────────────────────────────────────
register_activation_hook( __FILE__, 'pfg_activate' );
function pfg_activate() {
    global $wpdb;
    $table   = $wpdb->prefix . 'pfg_assessments';
    $charset = $wpdb->get_charset_collate();
    $sql = "CREATE TABLE IF NOT EXISTS {$table} (
        id bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT,
        user_name varchar(100) NOT NULL,
        company varchar(100) NOT NULL,
        department varchar(100) NOT NULL,
        email varchar(100) NOT NULL,
        score_communication tinyint(2) NOT NULL,
        score_knowledge tinyint(2) NOT NULL,
        score_leadership tinyint(2) NOT NULL,
        score_measurement tinyint(2) NOT NULL,
        score_morale tinyint(2) NOT NULL,
        score_process tinyint(2) NOT NULL,
        score_recognition tinyint(2) NOT NULL,
        score_resource_qty tinyint(2) NOT NULL,
        score_resource_qual tinyint(2) NOT NULL,
        score_standards tinyint(2) NOT NULL,
        total_score tinyint(3) NOT NULL,
        submitted_at datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (id)
    ) {$charset};";
    require_once ABSPATH . 'wp-admin/includes/upgrade.php';
    dbDelta( $sql );
    update_option( 'pfg_db_version', '1.0.0' );
}

// ─── ENQUEUE ASSETS ───────────────────────────────────────────────────────
add_action( 'wp_enqueue_scripts', 'pfg_enqueue_assets' );
function pfg_enqueue_assets() {
    wp_enqueue_style(
        'pfg-google-fonts',
        'https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap',
        [], null
    );
    wp_enqueue_style( 'pfg-style', PFG_PLUGIN_URL . 'assets/css/style.css', [], '1.0.0' );
    wp_enqueue_script(
        'chart-js',
        'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js',
        [], '4.4.0', true
    );
    wp_enqueue_script( 'pfg-engine', PFG_PLUGIN_URL . 'assets/js/engine.js', [ 'chart-js' ], '1.0.0', true );
    wp_localize_script( 'pfg-engine', 'pfgData', [
        'ajaxUrl' => admin_url( 'admin-ajax.php' ),
        'nonce'   => wp_create_nonce( 'pfg_submit_nonce' ),
    ] );
}

// ─── SHORTCODE ────────────────────────────────────────────────────────────
add_shortcode( 'pfg_assessment', 'pfg_render_assessment' );
function pfg_render_assessment() {
    if ( ! is_user_logged_in() ) {
        return '<p class="pfg-login-notice">Please <a href="' . esc_url( wp_login_url( get_permalink() ) ) . '">log in</a> to take the assessment.</p>';
    }

    $csfs = [
        'communication' => [ 'label' => 'Communication',       'tip' => 'The effectiveness of information flow across the team and organization.' ],
        'knowledge'     => [ 'label' => 'Knowledge & Skills',  'tip' => 'The level of expertise and competencies team members currently possess.' ],
        'leadership'    => [ 'label' => 'Leadership',          'tip' => 'The quality of direction, guidance, and motivation from management.' ],
        'measurement'   => [ 'label' => 'Measurement',         'tip' => 'The ability to track, monitor, and evaluate key performance metrics.' ],
        'morale'        => [ 'label' => 'Morale',              'tip' => 'Overall team spirit, engagement, and motivation levels.' ],
        'process'       => [ 'label' => 'Process & Procedure', 'tip' => 'Clarity and effectiveness of established workflows and operational protocols.' ],
        'recognition'   => [ 'label' => 'Recognition',         'tip' => 'How well achievements and contributions are acknowledged and rewarded.' ],
        'resource_qty'  => [ 'label' => 'Resource (Quantity)', 'tip' => 'Whether sufficient personnel and materials are available to meet demands.' ],
        'resource_qual' => [ 'label' => 'Resource (Quality)',  'tip' => 'Whether personnel and materials meet the required standards of excellence.' ],
        'standards'     => [ 'label' => 'Standards',           'tip' => 'The clarity and consistent enforcement of performance expectations.' ],
    ];

    ob_start();
    ?>
    <div id="pfg-wrap">

        <!-- ASSESSMENT FORM -->
        <div id="pfg-form-section">
            <div class="pfg-header">
                <div class="pfg-logo-mark">GLO</div>
                <h1 class="pfg-title">PFG Predictive Index</h1>
                <p class="pfg-subtitle">Manager Performance Assessment</p>
            </div>

            <form id="pfg-form" novalidate>
                <?php wp_nonce_field( 'pfg_submit_nonce', 'pfg_nonce_field' ); ?>

                <section class="pfg-section pfg-capture">
                    <h2 class="pfg-section-title">Your Information</h2>
                    <div class="pfg-grid-2">
                        <div class="pfg-field">
                            <label for="pfg-name">Full Name <span class="req">*</span></label>
                            <input type="text" id="pfg-name" name="user_name" placeholder="e.g. Jane Smith" required>
                        </div>
                        <div class="pfg-field">
                            <label for="pfg-email">Email <span class="req">*</span></label>
                            <input type="email" id="pfg-email" name="email" placeholder="jane@company.com" required>
                        </div>
                        <div class="pfg-field">
                            <label for="pfg-company">Company <span class="req">*</span></label>
                            <input type="text" id="pfg-company" name="company" placeholder="Company name" required>
                        </div>
                        <div class="pfg-field">
                            <label for="pfg-dept">Department / Unit <span class="req">*</span></label>
                            <input type="text" id="pfg-dept" name="department" placeholder="e.g. Operations" required>
                        </div>
                    </div>
                </section>

                <section class="pfg-section pfg-assessment">
                    <h2 class="pfg-section-title">Critical Success Factors</h2>
                    <p class="pfg-section-desc">Rate each factor from <strong>1</strong> (Critically Low) to <strong>10</strong> (Excellent). All 10 must be completed.</p>
                    <div class="pfg-csf-list">
                    <?php $i = 1; foreach ( $csfs as $key => $csf ) : ?>
                        <div class="pfg-csf-row">
                            <div class="pfg-csf-label-wrap">
                                <span class="pfg-csf-num"><?php echo esc_html( sprintf( '%02d', $i++ ) ); ?></span>
                                <span class="pfg-csf-name"><?php echo esc_html( $csf['label'] ); ?></span>
                                <span class="pfg-tooltip-icon" data-tip="<?php echo esc_attr( $csf['tip'] ); ?>">?</span>
                            </div>
                            <div class="pfg-csf-input-wrap">
                                <input type="range" class="pfg-slider"
                                    id="csf-<?php echo esc_attr( $key ); ?>"
                                    name="score_<?php echo esc_attr( $key ); ?>"
                                    min="1" max="10" value="5" data-unset="true">
                                <span class="pfg-slider-val" id="val-<?php echo esc_attr( $key ); ?>">&#8211;</span>
                            </div>
                        </div>
                    <?php endforeach; ?>
                    </div>
                    <div class="pfg-live-score-wrap">
                        <span class="pfg-live-label">Live Total Score:</span>
                        <span id="pfg-live-total" class="pfg-live-total">&#8211;</span>
                        <span class="pfg-live-max">/ 100</span>
                    </div>
                </section>

                <div id="pfg-error-msg" class="pfg-error" style="display:none;"></div>

                <button type="submit" id="pfg-submit-btn" class="pfg-btn-primary">
                    <span class="btn-text">Submit Assessment</span>
                    <span class="btn-loading" style="display:none;">Submitting&#8230;</span>
                </button>
            </form>
        </div>

        <!-- RESULTS SECTION -->
        <div id="pfg-results" style="display:none;">
            <div class="pfg-header">
                <div class="pfg-logo-mark">GLO</div>
                <h1 class="pfg-title">Assessment Results</h1>
            </div>
            <div class="pfg-results-body">
                <div class="pfg-score-card">
                    <p class="pfg-score-label">Total Score</p>
                    <div class="pfg-score-circle">
                        <span id="res-total">&#8211;</span>
                        <small>/ 100</small>
                    </div>
                    <div id="res-tier" class="pfg-tier-badge">&#8211;</div>
                </div>
                <div class="pfg-chart-wrap">
                    <canvas id="pfg-chart"></canvas>
                </div>
            </div>
            <button id="pfg-retake-btn" class="pfg-btn-secondary">Take Assessment Again</button>
        </div>

    </div>
    <?php
    return ob_get_clean();
}

// ─── AJAX HANDLER ─────────────────────────────────────────────────────────
add_action( 'wp_ajax_pfg_submit', 'pfg_handle_submit' );
function pfg_handle_submit() {
    check_ajax_referer( 'pfg_submit_nonce', 'nonce' );

    if ( ! is_user_logged_in() ) {
        wp_send_json_error( [ 'message' => 'Authentication required.' ] );
    }

    $csf_keys = [
        'communication', 'knowledge', 'leadership', 'measurement', 'morale',
        'process', 'recognition', 'resource_qty', 'resource_qual', 'standards',
    ];

    $scores = [];
    foreach ( $csf_keys as $key ) {
        $val = isset( $_POST[ 'score_' . $key ] ) ? intval( $_POST[ 'score_' . $key ] ) : 0;
        if ( $val < 1 || $val > 10 ) {
            wp_send_json_error( [ 'message' => 'All 10 CSF scores must be between 1 and 10.' ] );
        }
        $scores[ $key ] = $val;
    }

    $total = array_sum( $scores );

    global $wpdb;
    $table  = $wpdb->prefix . 'pfg_assessments';
    $result = $wpdb->insert( $table, [
        'user_name'           => sanitize_text_field( wp_unslash( $_POST['user_name'] ?? '' ) ),
        'company'             => sanitize_text_field( wp_unslash( $_POST['company'] ?? '' ) ),
        'department'          => sanitize_text_field( wp_unslash( $_POST['department'] ?? '' ) ),
        'email'               => sanitize_email( wp_unslash( $_POST['email'] ?? '' ) ),
        'score_communication' => $scores['communication'],
        'score_knowledge'     => $scores['knowledge'],
        'score_leadership'    => $scores['leadership'],
        'score_measurement'   => $scores['measurement'],
        'score_morale'        => $scores['morale'],
        'score_process'       => $scores['process'],
        'score_recognition'   => $scores['recognition'],
        'score_resource_qty'  => $scores['resource_qty'],
        'score_resource_qual' => $scores['resource_qual'],
        'score_standards'     => $scores['standards'],
        'total_score'         => $total,
    ] );

    if ( false === $result ) {
        wp_send_json_error( [ 'message' => 'Database error. Please try again.' ] );
    }

    wp_send_json_success( [
        'total'  => $total,
        'scores' => array_values( $scores ),
        'tier'   => pfg_get_tier( $total ),
    ] );
}

function pfg_get_tier( int $score ): string {
    if ( $score >= 90 ) return 'High Performing';
    if ( $score >= 80 ) return 'Strong';
    if ( $score >= 70 ) return 'Stable';
    if ( $score >= 60 ) return 'Developing';
    return 'At Risk';
}

// ─── ADMIN PAGE ───────────────────────────────────────────────────────────
add_action( 'admin_menu', 'pfg_admin_menu' );
function pfg_admin_menu() {
    add_menu_page(
        'PFG Assessments', 'PFG Assessments',
        'manage_options', 'pfg-assessments',
        'pfg_render_admin_page',
        'dashicons-chart-bar', 30
    );
}

function pfg_render_admin_page() {
    global $wpdb;
    $table = $wpdb->prefix . 'pfg_assessments';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY submitted_at DESC" );
    ?>
    <div class="wrap">
        <h1>PFG Predictive Index &#8212; Submissions</h1>
        <table class="wp-list-table widefat fixed striped">
            <thead>
                <tr>
                    <th>#</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Department</th>
                    <th>Email</th>
                    <th>Total Score</th>
                    <th>Tier</th>
                    <th>Date</th>
                </tr>
            </thead>
            <tbody>
            <?php if ( empty( $rows ) ) : ?>
                <tr><td colspan="8">No submissions yet.</td></tr>
            <?php else : foreach ( $rows as $row ) : ?>
                <tr>
                    <td><?php echo esc_html( $row->id ); ?></td>
                    <td><?php echo esc_html( $row->user_name ); ?></td>
                    <td><?php echo esc_html( $row->company ); ?></td>
                    <td><?php echo esc_html( $row->department ); ?></td>
                    <td><?php echo esc_html( $row->email ); ?></td>
                    <td><strong><?php echo esc_html( $row->total_score ); ?></strong></td>
                    <td><?php echo esc_html( pfg_get_tier( (int) $row->total_score ) ); ?></td>
                    <td><?php echo esc_html( $row->submitted_at ); ?></td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
    </div>
    <?php
}
