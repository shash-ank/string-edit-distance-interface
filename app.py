from flask import Flask, render_template, request, jsonify
import json

app = Flask(__name__)

MATCH = 0
INSERT = 1
DELETE = 2

MAX_LENGTH = 100  # Maximum allowed length for input strings

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/compute', methods=['POST'])
def compute():
    s = request.form.get('stringA', '').strip()
    t = request.form.get('stringB', '').strip()

    if not s or not t:
        return "Please provide both strings.", 400

    if len(s) > MAX_LENGTH or len(t) > MAX_LENGTH:
        return f"Strings must be at most {MAX_LENGTH} characters long.", 400

    dist, dp, parent = compute_edit_distance_with_parents(s, t)
    dp_html = dp_table_to_html(s, t, dp)
    operations, path_cells = reconstruct_path(s, t, parent)

    # Convert dp and path_cells to JSON-safe format
    # path_cells is a list of (i,j), dp is a 2D list of ints
    return render_template('result.html',
                           s=s, t=t,
                           dist=dist,
                           operations=operations,
                           dp_json=json.dumps(dp),
                           path_cells_json=json.dumps(path_cells), dp_html=dp_html)

def compute_edit_distance_with_parents(s, t):
    m, n = len(s), len(t)
    dp = [[0]*(n+1) for _ in range(m+1)]
    parent = [[-1]*(n+1) for _ in range(m+1)]

    for i in range(m+1):
        dp[i][0] = i
        if i > 0:
            parent[i][0] = DELETE
    for j in range(n+1):
        dp[0][j] = j
        if j > 0:
            parent[0][j] = INSERT

    for i in range(1, m+1):
        for j in range(1, n+1):
            cost_match = dp[i-1][j-1] + (0 if s[i-1] == t[j-1] else 1)
            cost_insert = dp[i][j-1] + 1
            cost_delete = dp[i-1][j] + 1

            p = MATCH
            min_cost = cost_match
            if cost_insert < min_cost:
                min_cost = cost_insert
                p = INSERT
            if cost_delete < min_cost:
                min_cost = cost_delete
                p = DELETE

            dp[i][j] = min_cost
            parent[i][j] = p

    return dp[m][n], dp, parent

def reconstruct_path(s, t, parent):
    #We'll walk backwards from (m,n) to (0,0) and record path cells.
    m, n = len(s), len(t)
    i, j = m, n
    operations = []
    path_cells = []

    # We store the path cells as we go along
    while not (i == 0 and j == 0):
        path_cells.append((i, j))
        p = parent[i][j]
        if p == MATCH:
            if s[i-1] != t[j-1]:
                operations.append(f"Substitute '{s[i-1]}' with '{t[j-1]}'")
            i -= 1
            j -= 1
        elif p == INSERT:
            operations.append(f"Insert '{t[j-1]}'")
            j -= 1
        elif p == DELETE:
            operations.append(f"Delete '{s[i-1]}'")
            i -= 1

    path_cells.append((0,0))  # Include the start cell
    path_cells.reverse()
    operations.reverse()
    return operations, path_cells

def dp_table_to_html(s, t, dp):
    # Convert the DP table to an HTML table for display.
    
    html = "<table class='dp-table'><tr><th></th><th></th>"
    for ch in t:
        html += f"<th>{ch}</th>"
    html += "</tr>"

    for i in range(len(dp)):
        html += "<tr>"
        if i == 0:
            html += "<th></th>"
        else:
            html += f"<th>{s[i-1]}</th>"
        for val in dp[i]:
            html += f"<td>{val}</td>"
        html += "</tr>"
    html += "</table>"
    return html

if __name__ == '__main__':
    app.run(debug=True)
