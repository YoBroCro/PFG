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
    $csfs = [
        'communication' => [
            'label' => 'Communication',
            'tip'   => "There's an atmosphere of open communication.\nMy people are informed.\nThere's a two way dialogue between me and team.\nMy department meet on consistent and regular basis.\nMy team members communicate with each other effectively.\nInformation is quickly and clearly dispersed to team.\nInformation is delivered in an effective way.\nInformation is fully understood by team.",
        ],
        'knowledge'     => [
            'label' => 'Knowledge & Skills',
            'tip'   => 'Team have capacity to do job function and responsibility.',
        ],
        'leadership'    => [
            'label' => 'Leadership',
            'tip'   => 'How well is the team inspired by you to do "Great" things?',
        ],
        'measurement'   => [
            'label' => 'Measurement',
            'tip'   => "Tools are in place to quantify the efficiency and effectiveness of department's performance.\nTied to \"Standards\".",
        ],
        'morale'        => [
            'label' => 'Morale',
            'tip'   => 'The state of mind or spirit de corps of the group as exhibited by confidence, cheerfulness, discipline, belief and willingness to follow superior and goals of the organization; work well with members of the group as well as perform the assigned tasks.',
        ],
        'process'       => [
            'label' => 'Process & Procedure',
            'tip'   => 'The P&P of the department are in place and clear.',
        ],
        'recognition'   => [
            'label' => 'Recognition',
            'tip'   => 'How well achievements and contributions are acknowledged and rewarded.',
        ],
        'resource_qty'  => [
            'label' => 'Resource (Quantity)',
            'tip'   => 'Department is appropriately staffed.',
        ],
        'resource_qual' => [
            'label' => 'Resource (Quality)',
            'tip'   => 'The team has the mental capacity, attitude and aptitude to learn and perform job functions.',
        ],
        'standards'     => [
            'label' => 'Standards',
            'tip'   => "Clear written and communicated criterias, requirements and benchmarks to be appraised at a particular level of performance.\n\nStandards include:\n\u{2022} Quality \u{2013} how well the work is performed; accuracy, appearance, usefulness.\n\u{2022} Quantity \u{2013} how much work is produced or a general result to be achieved.\n\u{2022} Timeliness \u{2013} how quickly or by what date the work is produced.\n\u{2022} Cost-Effectiveness \u{2013} dollar savings; working within a budget; reducing unit costs.",
        ],
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
add_action( 'wp_ajax_pfg_submit',        'pfg_handle_submit' );
add_action( 'wp_ajax_nopriv_pfg_submit', 'pfg_handle_submit' );
function pfg_handle_submit() {
    check_ajax_referer( 'pfg_submit_nonce', 'nonce' );

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

    $csf_cols = [
        'score_communication' => 'Comm.',
        'score_knowledge'     => 'Know.',
        'score_leadership'    => 'Lead.',
        'score_measurement'   => 'Meas.',
        'score_morale'        => 'Morale',
        'score_process'       => 'Proc.',
        'score_recognition'   => 'Recog.',
        'score_resource_qty'  => 'Res.Qty',
        'score_resource_qual' => 'Res.Qual',
        'score_standards'     => 'Std.',
    ];

    // Filters
    $filter_company = isset( $_GET['pfg_company'] ) ? sanitize_text_field( wp_unslash( $_GET['pfg_company'] ) ) : '';
    $filter_dept    = isset( $_GET['pfg_dept'] )    ? sanitize_text_field( wp_unslash( $_GET['pfg_dept'] ) )    : '';

    $where  = 'WHERE 1=1';
    $params = [];
    if ( $filter_company ) { $where .= ' AND company = %s';    $params[] = $filter_company; }
    if ( $filter_dept )    { $where .= ' AND department = %s'; $params[] = $filter_dept; }

    // phpcs:disable WordPress.DB.DirectDatabaseQuery,WordPress.DB.PreparedSQL.NotPrepared
    if ( $params ) {
        // phpcs:ignore WordPress.DB.PreparedSQLPlaceholders.ReplacementsWrongNumber
        $rows = $wpdb->get_results( $wpdb->prepare( "SELECT * FROM {$table} {$where} ORDER BY submitted_at DESC", ...$params ) );
    } else {
        $rows = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY submitted_at DESC" );
    }

    // Aggregate averages (unfiltered)
    $avg_total = $wpdb->get_var( "SELECT AVG(total_score) FROM {$table}" );
    $csf_avgs  = [];
    foreach ( array_keys( $csf_cols ) as $col ) {
        $csf_avgs[ $col ] = $wpdb->get_var( "SELECT AVG({$col}) FROM {$table}" );
    }

    // Filter option lists
    $companies   = $wpdb->get_col( "SELECT DISTINCT company FROM {$table} ORDER BY company" );
    $departments = $wpdb->get_col( "SELECT DISTINCT department FROM {$table} ORDER BY department" );
    // phpcs:enable

    $page_url = admin_url( 'admin.php?page=pfg-assessments' );
    ?>
    <div class="wrap">
        <h1 style="display:flex;align-items:center;gap:12px;">
            PFG Predictive Index &#8212; Submissions
            <a href="<?php echo esc_url( admin_url( 'admin-post.php?action=pfg_export_csv' ) ); ?>"
               class="button button-secondary">&#8595; Export CSV</a>
        </h1>

        <!-- Aggregate Averages -->
        <?php if ( $avg_total ) : ?>
        <div style="background:#fff;border:1px solid #ddd;border-radius:8px;padding:16px 20px;margin:16px 0;">
            <strong>Aggregate Averages</strong>
            <table style="margin-top:10px;border-collapse:collapse;width:100%;">
                <tr>
                    <th style="text-align:left;padding:4px 10px 4px 0;white-space:nowrap;">Total Score Avg</th>
                    <td style="padding:4px 0;"><strong><?php echo esc_html( number_format( (float) $avg_total, 1 ) ); ?> / 100</strong></td>
                </tr>
                <?php foreach ( $csf_cols as $col => $label ) : ?>
                <tr>
                    <th style="text-align:left;padding:4px 10px 4px 0;white-space:nowrap;font-weight:normal;"><?php echo esc_html( $label ); ?></th>
                    <td style="padding:4px 0;"><?php echo esc_html( number_format( (float) $csf_avgs[ $col ], 1 ) ); ?> / 10</td>
                </tr>
                <?php endforeach; ?>
            </table>
        </div>
        <?php endif; ?>

        <!-- Filters -->
        <form method="get" action="<?php echo esc_url( $page_url ); ?>" style="margin-bottom:16px;">
            <input type="hidden" name="page" value="pfg-assessments">
            <select name="pfg_company" style="margin-right:8px;">
                <option value="">All Companies</option>
                <?php foreach ( $companies as $c ) : ?>
                    <option value="<?php echo esc_attr( $c ); ?>" <?php selected( $filter_company, $c ); ?>><?php echo esc_html( $c ); ?></option>
                <?php endforeach; ?>
            </select>
            <select name="pfg_dept" style="margin-right:8px;">
                <option value="">All Departments</option>
                <?php foreach ( $departments as $d ) : ?>
                    <option value="<?php echo esc_attr( $d ); ?>" <?php selected( $filter_dept, $d ); ?>><?php echo esc_html( $d ); ?></option>
                <?php endforeach; ?>
            </select>
            <button type="submit" class="button">Filter</button>
            <?php if ( $filter_company || $filter_dept ) : ?>
                <a href="<?php echo esc_url( $page_url ); ?>" class="button" style="margin-left:6px;">Clear</a>
            <?php endif; ?>
        </form>

        <!-- Submissions Table -->
        <div style="overflow-x:auto;">
        <table class="wp-list-table widefat fixed striped" style="min-width:1100px;">
            <thead>
                <tr>
                    <th style="width:32px">#</th>
                    <th>Name</th>
                    <th>Company</th>
                    <th>Dept</th>
                    <th>Email</th>
                    <?php foreach ( $csf_cols as $col => $label ) : ?>
                        <th style="width:56px;text-align:center;" title="<?php echo esc_attr( $col ); ?>"><?php echo esc_html( $label ); ?></th>
                    <?php endforeach; ?>
                    <th style="width:56px;text-align:center;">Total</th>
                    <th style="width:90px;">Tier</th>
                    <th style="width:130px;">Date</th>
                </tr>
            </thead>
            <tbody>
            <?php if ( empty( $rows ) ) : ?>
                <tr><td colspan="<?php echo 8 + count( $csf_cols ); ?>">No submissions found.</td></tr>
            <?php else : foreach ( $rows as $row ) : ?>
                <tr>
                    <td><?php echo esc_html( $row->id ); ?></td>
                    <td><?php echo esc_html( $row->user_name ); ?></td>
                    <td><?php echo esc_html( $row->company ); ?></td>
                    <td><?php echo esc_html( $row->department ); ?></td>
                    <td><?php echo esc_html( $row->email ); ?></td>
                    <?php foreach ( array_keys( $csf_cols ) as $col ) : ?>
                        <td style="text-align:center;"><?php echo esc_html( $row->$col ); ?></td>
                    <?php endforeach; ?>
                    <td style="text-align:center;"><strong><?php echo esc_html( $row->total_score ); ?></strong></td>
                    <td><?php echo esc_html( pfg_get_tier( (int) $row->total_score ) ); ?></td>
                    <td><?php echo esc_html( $row->submitted_at ); ?></td>
                </tr>
            <?php endforeach; endif; ?>
            </tbody>
        </table>
        </div>
    </div>
    <?php
}

// ─── CSV EXPORT ───────────────────────────────────────────────────────────
add_action( 'admin_post_pfg_export_csv', 'pfg_export_csv' );
function pfg_export_csv() {
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_die( 'Unauthorised.' );
    }

    global $wpdb;
    $table = $wpdb->prefix . 'pfg_assessments';
    // phpcs:ignore WordPress.DB.DirectDatabaseQuery
    $rows  = $wpdb->get_results( "SELECT * FROM {$table} ORDER BY submitted_at DESC", ARRAY_A );

    $filename = 'pfg-assessments-' . gmdate( 'Y-m-d' ) . '.csv';
    header( 'Content-Type: text/csv; charset=utf-8' );
    header( 'Content-Disposition: attachment; filename="' . $filename . '"' );

    $out = fopen( 'php://output', 'w' );
    fputcsv( $out, [
        'ID', 'Name', 'Company', 'Department', 'Email',
        'Communication', 'Knowledge', 'Leadership', 'Measurement', 'Morale',
        'Process', 'Recognition', 'Resource Qty', 'Resource Qual', 'Standards',
        'Total Score', 'Tier', 'Submitted At',
    ] );

    foreach ( $rows as $row ) {
        fputcsv( $out, [
            $row['id'],
            $row['user_name'],
            $row['company'],
            $row['department'],
            $row['email'],
            $row['score_communication'],
            $row['score_knowledge'],
            $row['score_leadership'],
            $row['score_measurement'],
            $row['score_morale'],
            $row['score_process'],
            $row['score_recognition'],
            $row['score_resource_qty'],
            $row['score_resource_qual'],
            $row['score_standards'],
            $row['total_score'],
            pfg_get_tier( (int) $row['total_score'] ),
            $row['submitted_at'],
        ] );
    }
    fclose( $out );
    exit;
}
