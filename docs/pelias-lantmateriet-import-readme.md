# Importing Lantmäteriet CSV Data into Pelias (Kubernetes + Flux)

This guide outlines a **repeatable workflow** for importing a new Lantmäteriet `.tgz` dataset into the `lantmateriet` PersistentVolumeClaim (PVC) and indexing it into Elasticsearch using the **`pelias-csv-importer`** pod.

---

## 📦 1. Upload the `.tgz` to the PVC

### 1.1 Start a temporary uploader pod

```bash
kubectl apply -f - <<'EOF'
apiVersion: v1
kind: Pod
metadata:
  name: pvc-uploader
  namespace: pelias
spec:
  restartPolicy: Never
  containers:
  - name: uploader
    image: alpine
    command: ["sh","-c","sleep infinity"]
    volumeMounts:
    - name: lantmateriet
      mountPath: /data
  volumes:
  - name: lantmateriet
    persistentVolumeClaim:
      claimName: lantmateriet
EOF
```

Wait until the pod is in **Running** state:

```bash
kubectl get pods -n pelias
```

---

### 1.2 Copy the `.tgz` file into the PVC

```bash
kubectl cp ./lantmateriet.tgz pelias/pvc-uploader:/data/lantmateriet.tgz
```

---

### 1.3 Extract and fix permissions

```bash
kubectl exec -n pelias -it pvc-uploader -- sh -c '
  mkdir -p /data && tar --no-same-owner -xzf /data/lantmateriet.tgz -C /data && chmod 755 /data/lost+found || true
'
```

---

### 1.4 Clean up the uploader pod

```bash
kubectl delete pod pvc-uploader -n pelias
```

---

## ⚙️ 2. Trigger the Pelias import

Once the files are unpacked and placed correctly in the PVC, run the following command to start the Pelias import job:

```bash
kubectl exec -n pelias -it pelias-csv-importer -- \
  sh -c 'cd /code/pelias/csv-importer && ./bin/start'
```

This command will start the import process using the data available under `/data` in the `lantmateriet` PVC.

---

✅ That’s it! You’ve uploaded and imported new Lantmäteriet data into Pelias.
